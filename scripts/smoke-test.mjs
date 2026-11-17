/**
 * Production API smoke test. Uses only public GET endpoints; no credentials.
 * Run: API_BASE_URL=https://... node scripts/smoke-test.mjs
 */
import assert from "node:assert/strict";

const baseUrl = (process.env.API_BASE_URL || "https://ai-workspace-api-327r.onrender.com").replace(/\/$/, "");
const maxAttempts = Number(process.env.SMOKE_MAX_ATTEMPTS || 12);
const retryDelayMs = Number(process.env.SMOKE_RETRY_DELAY_MS || 15000);
const timeoutMs = 12000;

if (!/^https:\/\//.test(baseUrl)) throw new Error("API_BASE_URL must be HTTPS");
if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 30) throw new Error("Invalid SMOKE_MAX_ATTEMPTS");
if (!Number.isInteger(retryDelayMs) || retryDelayMs < 0 || retryDelayMs > 60000) throw new Error("Invalid SMOKE_RETRY_DELAY_MS");

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(path) {
  const response = await fetch(baseUrl + path, {
    method: "GET",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "error",
  });
  let body;
  try {
    body = await response.json();
  } catch {
    throw Object.assign(new Error(`${path}: invalid JSON (HTTP ${response.status})`), {
      retryable: response.status >= 500,
    });
  }
  if (!response.ok) {
    const error = new Error(`${path}: HTTP ${response.status}`);
    error.retryable = response.status >= 500 || response.status === 429;
    throw error;
  }
  assert.match(response.headers.get("content-type") || "", /application\/json/i, `${path}: JSON content type`);
  return body;
}

async function retryReady(label, action) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await action();
      console.log(`PASS ${label} (attempt ${attempt}/${maxAttempts})`);
      return result;
    } catch (error) {
      // Transport failures, warm-up, and temporary server errors may recover.
      const retryable = error.retryable === true || error.name === "TimeoutError" || error.name === "TypeError";
      if (!retryable || attempt === maxAttempts) throw new Error(`${label}: ${error.message}`, { cause: error });
      console.log(`RETRY ${label} (attempt ${attempt}/${maxAttempts}): ${error.message}`);
      await pause(retryDelayMs);
    }
  }
}

function checkUser(user) {
  assert.equal(typeof user, "object");
  assert.ok(user !== null && !Array.isArray(user));
  assert.deepEqual(Object.keys(user).sort(), ["id", "name", "purpose", "status"]);
  assert.match(user.id, /^[0-9a-f]{24}$/i);
  assert.equal(typeof user.name, "string");
  assert.ok(["active", "inactive"].includes(user.status));
  assert.ok(user.purpose === null || typeof user.purpose === "string");
}

async function main() {
  console.log("Testing publicly reachable API endpoints (GET only).");
  const health = await retryReady("GET /health", async () => {
    const body = await getJson("/health");
    assert.deepEqual(body, { status: "ok", service: "ai-workspace-api" });
    return body;
  });
  assert.equal(health.status, "ok");

  const users = await retryReady("GET /api/users", async () => {
    const body = await getJson("/api/users");
    assert.ok(Array.isArray(body), "users should be an array");
    assert.ok(body.length > 0 && body.length <= 50, "demo user list should be nonempty and <= 50");
    body.forEach(checkUser);
    return body;
  });

  const selected = users[0];
  const byId = await getJson(`/api/users/${selected.id}`);
  assert.deepEqual(byId, selected, "ID lookup must return the selected user");
  console.log("PASS GET /api/users/:id");

  for (const status of ["active", "inactive"]) {
    const result = await getJson(`/api/users?status=${status}`);
    assert.ok(Array.isArray(result));
    result.forEach((user) => {
      checkUser(user);
      assert.equal(user.status, status);
    });
    console.log(`PASS GET /api/users?status=${status}`);
  }


  const todos = await retryReady("GET /api/todos", async () => {
    const items = await getJson("/api/todos");
    assert.ok(Array.isArray(items), "todos should be an array");
    assert.equal(items.length, 5, "five public demo todos were seeded");
    for (const item of items) {
      assert.deepEqual(Object.keys(item).sort(), ["completed", "id", "title"]);
      assert.match(item.id, /^[0-9a-f]{24}$/i);
      assert.equal(typeof item.title, "string");
      assert.equal(typeof item.completed, "boolean");
    }
    return items;
  });
  const todoById = await getJson(`/api/todos/${todos[0].id}`);
  assert.deepEqual(todoById, todos[0], "todo ID lookup must match selected todo");
  console.log("PASS GET /api/todos/:id");

  const stats = await retryReady("GET /api/stats", async () => {
    const body = await getJson("/api/stats");
    assert.deepEqual(Object.keys(body).sort(), ["startedAt", "totalRequests"]);
    assert.ok(Number.isSafeInteger(body.totalRequests) && body.totalRequests >= 0);
    assert.ok(!Number.isNaN(Date.parse(body.startedAt)));
    return body;
  });

  const details = await retryReady("GET /api/stats/details", async () => {
    const body = await getJson("/api/stats/details");
    assert.ok(Number.isSafeInteger(body.totalRequests) && body.totalRequests >= stats.totalRequests);
    assert.ok(Number.isSafeInteger(body.todayRequests) && body.todayRequests >= 0);
    assert.ok(Number.isSafeInteger(body.monthRequests) && body.monthRequests >= body.todayRequests);
    assert.equal(body.timezone, "Asia/Tokyo");
    assert.match(body.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(body.month, /^\d{4}-\d{2}$/);
    assert.ok(Array.isArray(body.last7Days) && body.last7Days.length === 7);
    assert.ok(Array.isArray(body.endpoints) && body.endpoints.length === 4);
    for (const day of body.last7Days) {
      assert.match(day.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(Number.isSafeInteger(day.requests) && day.requests >= 0);
    }
    for (const entry of body.endpoints) {
      assert.equal(typeof entry.path, "string");
      assert.ok(Number.isSafeInteger(entry.requests) && entry.requests >= 0);
    }
    return body;
  });

  console.log(`SUCCESS: production smoke test passed (users=${users.length}, todos=${todos.length}, requests=${details.totalRequests}, checks=9)`);
}

main().catch((error) => {
  console.error("SMOKE TEST FAILED:", error.message);
  process.exitCode = 1;
});
