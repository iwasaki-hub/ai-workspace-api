import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { createApp } from "../app.js";

const ids = [
  "6afaa9fb021f207d9648f5ad",
  "6afaa9fb021f207d9648f5ae",
  "6afaa9fb021f207d9648f5af",
];
const fixture = [
  { _id: new ObjectId(ids[0]), name: "デモ太郎", status: "active", purpose: "接続テスト", demo: true, secret: "never-expose" },
  { _id: new ObjectId(ids[1]), name: "デモ花子", status: "active", purpose: "読み取りテスト", demo: true },
  { _id: new ObjectId(ids[2]), name: "デモ次郎", status: "inactive", purpose: "検索テスト", demo: true },
  { _id: new ObjectId("6afaa9fb021f207d9648f5b0"), name: "非公開", status: "active", demo: false },
];

function mockCollection(data = fixture, observation = {}) {
  return {
    find(filter, options) {
      observation.filter = filter;
      observation.options = options;
      let records = data.filter((doc) =>
        doc.demo === filter.demo && (filter.status === undefined || doc.status === filter.status));
      return {
        sort(sort) {
          observation.sort = sort;
          records = records.sort((a, b) => a._id.toHexString().localeCompare(b._id.toHexString()));
          return this;
        },
        limit(limit) {
          observation.limit = limit;
          records = records.slice(0, limit);
          return this;
        },
        async toArray() { return records; },
      };
    },
    async findOne(filter, options) {
      observation.singleFilter = filter;
      observation.singleOptions = options;
      return data.find((doc) => doc.demo === filter.demo && doc._id.equals(filter._id)) || null;
    },
  };
}

async function withApp(run, { provider = async () => mockCollection(), configured = true } = {}) {
  const server = createApp({ collectionProvider: provider, databaseConfigured: configured }).listen(0, "127.0.0.1");
  try {
    await new Promise((resolve, reject) => {
      if (server.listening) return resolve();
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    return await run(base);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
}

async function request(base, path, options) {
  const response = await fetch(base + path, options);
  return { status: response.status, body: await response.json(), headers: response.headers };
}

test("GET /health returns service status without DB", async () => {
  await withApp(async (base) => {
    const r = await request(base, "/health");
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { status: "ok", service: "ai-workspace-api" });
  }, { provider: async () => { throw new Error("must not connect"); }, configured: false });
});

test("GET / serves EJS documentation", async () => {
  await withApp(async (base) => {
    const r = await fetch(base);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type"), /html/);
    const page = await r.text();
    assert.match(page, /AI Workspace/);
    assert.match(page, /\/api\/users/);
  }, { configured: false });
});

test("GET /api/users lists only demo documents and exposes only public fields", async () => {
  const observed = {};
  await withApp(async (base) => {
    const r = await request(base, "/api/users");
    assert.equal(r.status, 200);
    assert.equal(r.body.length, 3);
    assert.deepEqual(r.body.map((u) => u.name), ["デモ太郎", "デモ花子", "デモ次郎"]);
    assert.deepEqual(Object.keys(r.body[0]), ["id", "name", "status", "purpose"]);
    assert.equal(r.body[0].id, ids[0]);
    assert.deepEqual(observed.filter, { demo: true });
    assert.equal(observed.limit, 50);
    assert.deepEqual(observed.sort, { _id: 1 });
    assert.deepEqual(observed.options.projection, { name: 1, status: 1, purpose: 1 });
  }, { provider: async () => mockCollection(fixture, observed) });
});

test("GET /api/users?status=active filters active demos", async () => {
  const observed = {};
  await withApp(async (base) => {
    const r = await request(base, "/api/users?status=active");
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.map((u) => u.name), ["デモ太郎", "デモ花子"]);
    assert.deepEqual(observed.filter, { demo: true, status: "active" });
  }, { provider: async () => mockCollection(fixture, observed) });
});

test("GET /api/users?status=inactive filters inactive demos", async () => {
  await withApp(async (base) => {
    const r = await request(base, "/api/users?status=inactive");
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.map((u) => u.name), ["デモ次郎"]);
  });
});

test("GET /api/users/:id finds one demo by ObjectId", async () => {
  const observed = {};
  await withApp(async (base) => {
    const r = await request(base, `/api/users/${ids[1]}`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { id: ids[1], name: "デモ花子", status: "active", purpose: "読み取りテスト" });
    assert.equal(observed.singleFilter.demo, true);
    assert.equal(observed.singleFilter._id.toHexString(), ids[1]);
  }, { provider: async () => mockCollection(fixture, observed) });
});

test("GET /api/users rejects invalid status without contacting database", async () => {
  await withApp(async (base) => {
    for (const p of ["/api/users?status=wrong", "/api/users?status=active&status=inactive"]) {
      const r = await request(base, p);
      assert.equal(r.status, 400);
      assert.equal(r.body.error, "invalid_status");
    }
  }, { provider: async () => { throw new Error("unexpected DB access"); } });
});

test("GET /api/users/:id rejects invalid ID without contacting database", async () => {
  await withApp(async (base) => {
    const r = await request(base, "/api/users/not-an-object-id");
    assert.equal(r.status, 400);
    assert.equal(r.body.error, "invalid_id");
  }, { provider: async () => { throw new Error("unexpected DB access"); } });
});

test("GET /api/users/:id returns 404 for unknown or non-demo IDs", async () => {
  await withApp(async (base) => {
    for (const id of ["aaaaaaaaaaaaaaaaaaaaaaaa", "6afaa9fb021f207d9648f5b0"]) {
      const r = await request(base, `/api/users/${id}`);
      assert.equal(r.status, 404);
      assert.equal(r.body.error, "not_found");
    }
  });
});

test("GET /api/users returns 503 without DB configuration", async () => {
  const err = Object.assign(new Error("No URI"), { code: "DB_NOT_CONFIGURED" });
  await withApp(async (base) => {
    const r = await request(base, "/api/users");
    assert.equal(r.status, 503);
    assert.equal(r.body.error, "service_unavailable");
    assert.doesNotMatch(JSON.stringify(r.body), /No URI/);
  }, { provider: async () => { throw err; }, configured: false });
});

test("GET /api/users/:id returns safe 503 for unexpected DB errors", async () => {
  await withApp(async (base) => {
    const r = await request(base, `/api/users/${ids[0]}`);
    assert.equal(r.status, 503);
    assert.equal(r.body.error, "service_unavailable");
    assert.doesNotMatch(JSON.stringify(r.body), /password=super-secret/);
  }, { provider: async () => { throw new Error("password=super-secret"); } });
});

test("GET /api/users returns no more than 50 entries", async () => {
  const many = Array.from({ length: 64 }, (_, i) => ({
    _id: new ObjectId(i.toString(16).padStart(24, "0")),
    name: "デモ" + i, status: "active", purpose: "test", demo: true,
  }));
  await withApp(async (base) => {
    const r = await request(base, "/api/users");
    assert.equal(r.status, 200);
    assert.equal(r.body.length, 50);
  }, { provider: async () => mockCollection(many) });
});

test("write operations and unknown endpoints are not available", async () => {
  await withApp(async (base) => {
    const r = await request(base, "/api/users", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(r.status, 404);
    assert.equal(r.body.error, "not_found");
    const missing = await request(base, "/api/missing");
    assert.equal(missing.status, 404);
  });
});


test("GET / includes the interactive read-only API explorer", async () => {
  await withApp(async (base) => {
    const response = await fetch(base + "/");
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /id="api-explorer-form"/);
    assert.match(html, /id="api-endpoint"/);
    assert.match(html, /id="api-request-path"/);
    assert.match(html, /id="api-response"/);
    assert.match(html, /src="\/js\/explorer\.js"/);
    assert.match(html, /id="try-api"/);
  });
});

test("GET /js/explorer.js serves the API explorer client script", async () => {
  await withApp(async (base) => {
    const response = await fetch(base + "/js/explorer.js");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", /javascript/);
    const script = await response.text();
    assert.match(script, /credentials: "omit"/);
    assert.match(script, /output\.textContent = lastJson/);
    assert.doesNotMatch(script, /innerHTML/);
  });
});
