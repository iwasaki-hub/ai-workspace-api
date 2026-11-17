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

const todoFixture = [
  { _id: new ObjectId(ids[0]), title: "仕様書を確認する", completed: true, demo: true, secret: "not-public" },
  { _id: new ObjectId(ids[1]), title: "テストを追加する", completed: false, demo: true },
  { _id: new ObjectId(ids[2]), title: "非公開ToDo", completed: false, demo: false },
];

function mockMetricsCollection(initial = 0) {
  const state = { total: initial, daily: {}, monthly: {}, byEndpoint: {}, increments: [] };
  const collection = {
    async findOne(query, options) {
      assert.deepEqual(query, { _id: "public-api" });
      assert.ok(options.projection);
      return { ...state, startedAt: "2026-11-16T11:00:00.000Z" };
    },
    async updateOne(query, update, options) {
      assert.deepEqual(query, { _id: "public-api" });
      assert.equal(update.$inc.total, 1);
      assert.equal(Object.keys(update.$inc).length, 4);
      assert.equal(options.upsert, false);
      for (const [key, value] of Object.entries(update.$inc)) {
        assert.equal(value, 1);
        const parts = key.split(".");
        let target = state;
        for (const part of parts.slice(0, -1)) target = target[part];
        target[parts.at(-1)] = (target[parts.at(-1)] || 0) + value;
      }
      state.increments.push(update.$inc);
      return { modifiedCount: 1 };
    },
  };
  return { state, collection };
}

async function withApp(run, { provider = async () => mockCollection(), todoProvider = async () => mockCollection(todoFixture), metricsProvider, metricsNow, configured = true, rateLimitOptions, accessLogOptions = { write: () => {} }, visitorProvider = async () => fakeVisitorCollection(), visitorNow } = {}) {
  const { collection: metricsCollection } = mockMetricsCollection();
  const statsProvider = metricsProvider || (async () => metricsCollection);
  const server = createApp({ collectionProvider: provider, todoCollectionProvider: todoProvider, metricsCollectionProvider: statsProvider, metricsNow, databaseConfigured: configured, rateLimitOptions, accessLogOptions, visitorCollectionProvider: visitorProvider, visitorNow }).listen(0, "127.0.0.1");
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


test("GET /openapi.json is a valid OpenAPI contract matching implemented GET routes", async () => {
  const SwaggerParser = (await import("@apidevtools/swagger-parser")).default;
  await withApp(async (base) => {
    const response = await fetch(base + "/openapi.json");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", /application\/json/);
    const spec = await response.json();
    assert.equal(spec.openapi, "3.1.0");
    assert.equal(spec.info.title, "AI Workspace API");
    assert.deepEqual(Object.keys(spec.paths).sort(), ["/api/stats", "/api/stats/details", "/api/stats/visitors", "/api/todos", "/api/todos/{id}", "/api/users", "/api/users/{id}", "/health"]);
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      assert.deepEqual(Object.keys(pathItem), ["get"], `No write operations in ${path}`);
      assert.ok(pathItem.get.responses["200"]);
      const url = path.endsWith("/{id}") ? path.replace("/{id}", "/" + ids[0]) : path;
      const actual = await fetch(base + url);
      assert.equal(actual.status, 200, `documented GET ${url}`);
    }
    assert.deepEqual(Object.keys(spec.paths["/api/users"].get.responses).sort(), ["200", "400", "429", "503"]);
    assert.deepEqual(Object.keys(spec.paths["/api/users/{id}"].get.responses).sort(), ["200", "400", "404", "429", "503"]);
    assert.deepEqual(spec.paths["/api/users"].get.parameters[0].schema.enum, ["active", "inactive"]);
    assert.equal(spec.components.schemas.DemoUser.additionalProperties, false);
    assert.deepEqual(spec.components.schemas.DemoUser.required, ["id", "name", "status", "purpose"]);
    const validated = await SwaggerParser.validate(spec);
    assert.equal(validated.openapi, "3.1.0");
  });
});

test("GET /swagger serves locally hosted Swagger UI with read-only Try it out", async () => {
  await withApp(async (base) => {
    const htmlResponse = await fetch(base + "/swagger");
    assert.equal(htmlResponse.status, 200);
    assert.match(htmlResponse.headers.get("content-type") || "", /html/);
    const html = await htmlResponse.text();
    assert.match(html, /swagger-ui-bundle\.js/);
    assert.match(html, /swagger-init\.js/);
    assert.match(html, /openapi/i);
    const cssResponse = await fetch(base + "/swagger-assets/swagger-ui.css");
    assert.equal(cssResponse.status, 200);
    const bundleResponse = await fetch(base + "/swagger-assets/swagger-ui-bundle.js");
    assert.equal(bundleResponse.status, 200);
    const scriptResponse = await fetch(base + "/js/swagger-init.js");
    assert.equal(scriptResponse.status, 200);
    const script = await scriptResponse.text();
    assert.match(script, /url: "\/openapi\.json"/);
    assert.match(script, /supportedSubmitMethods: \["get"\]/);
  });
});

test("GET / documents OpenAPI and Swagger UI without breaking the original homepage", async () => {
  await withApp(async (base) => {
    const response = await fetch(base + "/");
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /href="\/swagger"/);
    assert.match(html, /href="\/openapi\.json"/);
    assert.match(html, /id="api-explorer-form"/);
  });
});


test("OpenAPI links are clearly styled as actions and remain accessible", async () => {
  await withApp(async (base) => {
    const home = await fetch(base + "/");
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.match(html, /class="openapi-callout"/);
    assert.match(html, /class="openapi-link openapi-link-primary" href="\/swagger"/);
    assert.match(html, /class="openapi-link openapi-link-secondary" href="\/openapi\.json"/);
    assert.match(html, /Swagger UIで見る/);
    assert.match(html, /JSON仕様書を見る/);
    const css = await fetch(base + "/css/style.css");
    assert.equal(css.status, 200);
    const styles = await css.text();
    assert.match(styles, /\.openapi-link:focus-visible/);
    assert.match(styles, /\.openapi-link-primary:hover/);
    assert.match(styles, /\.openapi-callout-actions\{width:100%;flex-direction:column\}/);
  });
});


test("Font Awesome icons are rendered server-side from a single allowlisted registry", async () => {
  const { icon, iconRegistry } = await import("../ui/icons.js");
  assert.ok(Object.isFrozen(iconRegistry));
  assert.equal(icon("github"), icon("github"), "rendered icons are cached");
  assert.match(icon("github"), /<svg[^>]*class="[^"]*ui-icon/);
  assert.match(icon("github"), /aria-hidden="true"/);
  assert.match(icon("github"), /<path/);
  assert.throws(() => icon("not-registered"), /Unknown Font Awesome icon key/);
  assert.throws(() => icon("__proto__"), /Unknown Font Awesome icon key/);
});

test("Home and navigation render Font Awesome SVG icons without CDN or duplicate icon definitions", async () => {
  await withApp(async (base) => {
    const response = await fetch(base);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /class="[^"]*ui-icon/);
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /href="\/#overview"[^>]*>\s*<svg/);
    assert.match(html, /href="\/#try-api"[^>]*>\s*<svg/);
    assert.match(html, /href="\/swagger"[^>]*>\s*<svg/);
    assert.match(html, /class="openapi-link openapi-link-primary" href="\/swagger"/);
    assert.match(html, /class="feature-icon"><svg/);
    assert.match(html, /href="\/examples"/);
    assert.match(html, /example-teaser-button/);
    assert.match(html, /data-response-copy-label/);
    assert.doesNotMatch(html, /kit\.fontawesome\.com|cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome/);
  });
});

test("Swagger and footer render shared icons and CSS includes responsive icon rules", async () => {
  await withApp(async (base) => {
    const swagger = await fetch(base + "/swagger");
    assert.equal(swagger.status, 200);
    const html = await swagger.text();
    assert.match(html, /class="swagger-header"/);
    assert.match(html, /<svg[^>]*ui-icon/);
    const stylesheet = await fetch(base + "/css/style.css");
    assert.equal(stylesheet.status, 200);
    const css = await stylesheet.text();
    assert.match(css, /\.ui-icon\{display:inline-block/);
    assert.match(css, /\.primary-nav>a\{display:inline-flex/);
    assert.match(css, /\.menu-toggle \.ui-icon/);
    const copyScript = await (await fetch(base + "/js/main.js")).text();
    assert.match(copyScript, /querySelector\("\[data-copy-label\]"\)/);
    const explorerScript = await (await fetch(base + "/js/explorer.js")).text();
    assert.match(explorerScript, /copyLabel\.textContent/);
  });
});


test("security headers apply to HTML, API JSON and Swagger without breaking response bodies", async () => {
  await withApp(async (base) => {
    for (const path of ["/", "/swagger", "/health", "/api/users"]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
      assert.equal(response.headers.get("x-frame-options"), "DENY");
      assert.equal(response.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");
      assert.equal(response.headers.get("x-powered-by"), null);
    }
  });
});

test("API limiter returns JSON 429 with RateLimit and Retry-After headers", async () => {
  await withApp(async (base) => {
    const options = { headers: { "X-Forwarded-For": "198.51.100.20" } };
    const first = await fetch(base + "/api/users", options);
    const second = await fetch(base + "/api/users?status=active", options);
    const third = await fetch(base + "/api/users/" + ids[0], options);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(third.status, 429);
    assert.deepEqual(await third.json(), {
      error: "rate_limited",
      message: "リクエストが集中しています。時間をおいて再試行してください。",
    });
    assert.ok(third.headers.get("retry-after"));
    assert.match(third.headers.get("ratelimit") || "", /remaining=0/);
    const health = await fetch(base + "/health", options);
    assert.equal(health.status, 200, "health checks are excluded");
    const home = await fetch(base + "/", options);
    assert.equal(home.status, 200, "documentation is excluded");
  }, { rateLimitOptions: { limit: 2, windowMs: 60_000, isRender: false } });
});

test("local limiter ignores spoofed forwarding headers", async () => {
  await withApp(async (base) => {
    const one = await fetch(base + "/api/users", { headers: { "CF-Connecting-IP": "203.0.113.4", "X-Forwarded-For": "203.0.113.5" } });
    const two = await fetch(base + "/api/users", { headers: { "CF-Connecting-IP": "203.0.113.6", "X-Forwarded-For": "203.0.113.7" } });
    assert.equal(one.status, 200);
    assert.equal(two.status, 429, "spoofed headers must not change local client identity");
  }, { rateLimitOptions: { limit: 1, windowMs: 60_000, isRender: false } });
});

test("Render limiter separates valid CF-Connecting-IP clients and ignores invalid values", async () => {
  await withApp(async (base) => {
    const requestFrom = (ip) => fetch(base + "/api/users", { headers: { "CF-Connecting-IP": ip } });
    assert.equal((await requestFrom("198.51.100.1")).status, 200);
    assert.equal((await requestFrom("198.51.100.1")).status, 429);
    assert.equal((await requestFrom("198.51.100.2")).status, 200);
    assert.equal((await requestFrom("invalid")).status, 200);
    assert.equal((await requestFrom("not-an-ip")).status, 429);
  }, { rateLimitOptions: { limit: 1, windowMs: 60_000, isRender: true } });
});

test("API rate limits do not affect existing 400 validation responses", async () => {
  await withApp(async (base) => {
    const r = await request(base, "/api/users?status=wrong");
    assert.equal(r.status, 400);
    assert.equal(r.body.error, "invalid_status");
    assert.ok(r.headers.get("ratelimit"));
  });
});


test("Resources section lists only implemented public resources below feature cards", async () => {
  const { publicResources } = await import("../ui/resources.js");
  assert.equal(publicResources.length, 2);
  assert.ok(Object.isFrozen(publicResources));
  assert.deepEqual(publicResources.map((resource) => resource.path), ["/api/users", "/api/todos"]);
  await withApp(async (base) => {
    const response = await fetch(base + "/");
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.indexOf("overview-section") < html.indexOf("resources-section"));
    assert.ok(html.indexOf("resources-section") < html.indexOf('id="endpoints"'));
    assert.match(html, /id="resources"/);
    assert.match(html, /利用できるリソース/);
    assert.match(html, /href="\/api\/users"[^>]*target="_blank"/);
    assert.match(html, /data-resource-count="\/api\/users"/);
    assert.match(html, /2 RESOURCES/);
    assert.doesNotMatch(html, /href="\/api\/(posts|comments|albums|photos)"/);
    assert.match(html, /src="\/js\/resources\.js"/);
  });
});

test("Resources CSS and shared Font Awesome registry support responsive and accessible links", async () => {
  const { icon } = await import("../ui/icons.js");
  assert.match(icon("users"), /<svg/);
  await withApp(async (base) => {
    const stylesheet = await fetch(base + "/css/style.css");
    assert.equal(stylesheet.status, 200);
    const css = await stylesheet.text();
    assert.match(css, /\.resource-link:focus-visible/);
    assert.match(css, /@media\(max-width:390px\)\{\.resource-row/);
    const script = await fetch(base + "/js/resources.js");
    assert.equal(script.status, 200);
    const js = await script.text();
    assert.match(js, /credentials: "omit"/);
    assert.match(js, /Array\.isArray\(data\)/);
    assert.match(js, /取得できません/);
  });
});

test("Resource counts show actual public result count, cap notice and error fallback", async () => {
  const { runInNewContext } = await import("node:vm");
  const { readFile } = await import("node:fs/promises");
  const script = await readFile(new URL("../public/js/resources.js", import.meta.url), "utf8");
  async function renderCount({ data, ok = true, fail = false }) {
    const counter = { dataset: { resourceCount: "/api/users", resourceMax: "50" }, textContent: "取得中…" };
    let calls = 0;
    const sandbox = {
      document: {
        querySelector: () => null,
        querySelectorAll: () => [counter],
      },
      fetch: async (endpoint, options) => {
        calls++;
        assert.equal(endpoint, "/api/users");
        assert.equal(options.method, "GET");
        assert.equal(options.credentials, "omit");
        if (fail) throw new Error("network failed");
        return { ok, json: async () => data };
      },
      AbortSignal,
    };
    await runInNewContext(script + "\nloadResourceCounts()", sandbox);
    return { text: counter.textContent, calls };
  }
  assert.deepEqual(await renderCount({ data: [{ id: 1 }, { id: 2 }, { id: 3 }] }), { text: "3件", calls: 1 });
  assert.deepEqual(await renderCount({ data: [] }), { text: "0件", calls: 1 });
  assert.deepEqual(await renderCount({ data: Array.from({ length: 50 }) }), { text: "50件（上限）", calls: 1 });
  assert.deepEqual(await renderCount({ data: [], ok: false }), { text: "取得できません", calls: 1 });
  assert.deepEqual(await renderCount({ fail: true }), { text: "取得できません", calls: 1 });
});


test("Motion is installed and its browser bundle is served locally", async () => {
  const { readFile } = await import("node:fs/promises");
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.dependencies.motion, "14.14.0");
  await withApp(async (base) => {
    const r = await fetch(base + "/motion-assets/motion.js");
    assert.equal(r.status, 200, "Motion browser bundle must exist in installed npm package");
    assert.match(r.headers.get("content-type") || "", /javascript/);
    const source = await r.text();
    assert.ok(source.length > 2000);
  });
});

test("Homepage loads Motion and centralized animations without breaking existing UI", async () => {
  await withApp(async (base) => {
    const r = await fetch(base + "/");
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.match(html, /src="\/motion-assets\/motion\.js" defer/);
    assert.match(html, /src="\/js\/animations\.js" defer/);
    assert.ok(html.indexOf("/motion-assets/motion.js") < html.indexOf("/js/animations.js"));
    assert.match(html, /id="resources"/);
    assert.match(html, /id="api-explorer-form"/);
    const js = await fetch(base + "/js/animations.js");
    assert.equal(js.status, 200);
    const source = await js.text();
    assert.match(source, /window\.Motion/);
    assert.match(source, /motion\.inView/);
    assert.match(source, /prefers-reduced-motion: reduce/);
    assert.match(source, /pointerenter/);
  });
});

test("Motion controller gracefully avoids animation when reduced motion is requested or library is absent", async () => {
  const { readFile } = await import("node:fs/promises");
  const { runInNewContext } = await import("node:vm");
  const js = await readFile(new URL("../public/js/animations.js", import.meta.url), "utf8");
  const doc = { querySelectorAll: () => { throw new Error("DOM should not be inspected"); } };
  assert.doesNotThrow(() => runInNewContext(js, {
    window: { matchMedia: () => ({ matches: true }) },
    document: doc,
  }));
  assert.doesNotThrow(() => runInNewContext(js, {
    window: { matchMedia: () => ({ matches: false }), Motion: undefined },
    document: doc,
  }));
});


test("Hamburger menu closes on page scroll and keeps ARIA state synchronized", async () => {
  const { readFile } = await import("node:fs/promises");
  const { runInNewContext } = await import("node:vm");
  const source = await readFile(new URL("../public/js/main.js", import.meta.url), "utf8");
  const buttonHandlers = {};
  const scrollHandlers = {};
  const linkHandlers = {};
  const attributes = new Map([["aria-expanded", "false"], ["aria-label", "メニューを開く"]]);
  const classes = new Set();
  const button = {
    getAttribute: (name) => attributes.get(name),
    setAttribute: (name, value) => attributes.set(name, value),
    addEventListener: (type, handler) => { buttonHandlers[type] = handler; },
  };
  const nav = {
    classList: {
      toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
    },
    querySelectorAll: () => [{ addEventListener: (type, handler) => { linkHandlers[type] = handler; } }],
  };
  const windowMock = {
    scrollY: 100,
    addEventListener: (type, handler, options) => { scrollHandlers[type] = { handler, options }; },
  };
  const documentMock = {
    querySelector: (selector) => selector === ".menu-toggle" ? button : nav,
    querySelectorAll: () => [],
  };
  runInNewContext(source, { window: windowMock, document: documentMock });
  assert.deepEqual(Object.keys(scrollHandlers), ["scroll"]);
  assert.equal(scrollHandlers.scroll.options.passive, true);
  buttonHandlers.click();
  assert.equal(attributes.get("aria-expanded"), "true");
  assert.equal(attributes.get("aria-label"), "メニューを閉じる");
  assert.ok(classes.has("is-open"));
  windowMock.scrollY = 102;
  scrollHandlers.scroll.handler();
  assert.ok(classes.has("is-open"), "minor scroll adjustments should not close menu");
  windowMock.scrollY = 105;
  scrollHandlers.scroll.handler();
  assert.equal(attributes.get("aria-expanded"), "false");
  assert.equal(attributes.get("aria-label"), "メニューを開く");
  assert.equal(classes.has("is-open"), false);

  // Opening at a different page position should use the new baseline.
  windowMock.scrollY = 300;
  buttonHandlers.click();
  assert.ok(classes.has("is-open"));
  windowMock.scrollY = 295;
  scrollHandlers.scroll.handler();
  assert.equal(classes.has("is-open"), false, "scrolling up also closes the menu");

  buttonHandlers.click();
  linkHandlers.click();
  assert.equal(attributes.get("aria-expanded"), "false");
  assert.equal(classes.has("is-open"), false);
});


test("Navigation labels and icons are high-contrast white on desktop and mobile", async () => {
  await withApp(async (base) => {
    const response = await fetch(base + "/css/style.css");
    assert.equal(response.status, 200);
    const css = await response.text();
    assert.match(css, /\.primary-nav>a\{font-size:13px;color:#fff;font-weight:600/);
    assert.match(css, /\.primary-nav>a \.ui-icon\{font-size:13px;opacity:1\}/);
    assert.match(css, /\.primary-nav\.is-open\{display:flex\}/);
    const html = await (await fetch(base + "/")).text();
    assert.match(html, /id="primary-nav" class="primary-nav"/);
    assert.match(html, /href="\/#overview"/);
  });
});


test("GET /api/todos returns only public demo fields and excludes non-demo documents", async () => {
  const observed = {};
  await withApp(async (base) => {
    const r = await request(base, "/api/todos");
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, [
      { id: ids[0], title: "仕様書を確認する", completed: true },
      { id: ids[1], title: "テストを追加する", completed: false },
    ]);
    assert.deepEqual(observed.filter, { demo: true });
    assert.deepEqual(observed.options.projection, { title: 1, completed: 1 });
    assert.equal(observed.limit, 50);
    assert.deepEqual(observed.sort, { _id: 1 });
    assert.doesNotMatch(JSON.stringify(r.body), /secret|非公開ToDo/);
  }, { todoProvider: async () => mockCollection(todoFixture, observed) });
});

test("GET /api/todos/:id returns public demo todo and rejects hidden or missing records", async () => {
  const observed = {};
  await withApp(async (base) => {
    const r = await request(base, "/api/todos/" + ids[1]);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { id: ids[1], title: "テストを追加する", completed: false });
    assert.equal(observed.singleFilter.demo, true);
    assert.equal(observed.singleFilter._id.toHexString(), ids[1]);
    assert.deepEqual(observed.singleOptions.projection, { title: 1, completed: 1 });
    for (const id of [ids[2], "aaaaaaaaaaaaaaaaaaaaaaaa"]) {
      const missing = await request(base, "/api/todos/" + id);
      assert.equal(missing.status, 404);
      assert.equal(missing.body.error, "not_found");
    }
  }, { todoProvider: async () => mockCollection(todoFixture, observed) });
});

test("Todos reject invalid IDs without database access and do not permit writes", async () => {
  await withApp(async (base) => {
    const invalid = await request(base, "/api/todos/not-an-id");
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error, "invalid_id");
    const write = await request(base, "/api/todos", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(write.status, 404);
    const update = await request(base, "/api/todos/" + ids[0], { method: "DELETE" });
    assert.equal(update.status, 404);
  }, { todoProvider: async () => { throw Error("Should not contact DB"); } });
});

test("Todos return a safe 503 on database error, without revealing secrets", async () => {
  await withApp(async (base) => {
    const r = await request(base, "/api/todos");
    assert.equal(r.status, 503);
    assert.equal(r.body.error, "service_unavailable");
    assert.doesNotMatch(JSON.stringify(r.body), /password=/);
  }, { todoProvider: async () => { throw new Error("password=secret"); } });
});

test("Todos list caps responses to 50 entries", async () => {
  const many = Array.from({ length: 56 }, (_, i) => ({
    _id: new ObjectId(i.toString(16).padStart(24, "0")), title: "タスク" + i, completed: false, demo: true,
  }));
  await withApp(async (base) => {
    const r = await request(base, "/api/todos");
    assert.equal(r.status, 200);
    assert.equal(r.body.length, 50);
  }, { todoProvider: async () => mockCollection(many) });
});

test("Swagger OpenAPI and homepage document the new todos resource", async () => {
  const { icon } = await import("../ui/icons.js");
  assert.match(icon("todo"), /<svg/);
  await withApp(async (base) => {
    const html = await (await fetch(base + "/")).text();
    assert.match(html, /href="\/api\/todos"/);
    assert.match(html, /data-resource-count="\/api\/todos"/);
    assert.match(html, /2 RESOURCES/);
    assert.match(html, /value="todos"/);
    assert.match(html, /value="todo-id"/);
    const js = await (await fetch(base + "/js/explorer.js")).text();
    assert.match(js, /case "todos": return "\/api\/todos"/);
    assert.match(js, /case "todo-id": return "\/api\/todos\/" \+ id\.value\.trim\(\)/);
    const spec = await (await fetch(base + "/openapi.json")).json();
    assert.deepEqual(Object.keys(spec.paths["/api/todos"].get.responses).sort(), ["200", "429", "503"]);
    assert.deepEqual(Object.keys(spec.paths["/api/todos/{id}"].get.responses).sort(), ["200", "400", "404", "429", "503"]);
    assert.deepEqual(spec.components.schemas.DemoTodo.required, ["id", "title", "completed"]);
    assert.equal(spec.components.schemas.DemoTodo.additionalProperties, false);
  });
});


test("API statistics return initialized aggregate and never invent numbers", async () => {
  const { state, collection } = mockMetricsCollection(22);
  await withApp(async (base) => {
    const r = await request(base, "/api/stats");
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { totalRequests: 22, startedAt: "2026-11-16T11:00:00.000Z" });
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.deepEqual(Object.keys(r.body), ["totalRequests", "startedAt"]);
  }, { metricsProvider: async () => collection });
  assert.equal(state.total, 22);
});

test("GET users and todos contribute to metrics while stats, health and pages do not", async () => {
  const { state, collection } = mockMetricsCollection();
  await withApp(async (base) => {
    for (const endpoint of ["/api/users", "/api/todos", "/api/users?status=active", "/api/todos/" + ids[0]]) {
      const response = await fetch(base + endpoint);
      assert.equal(response.status, 200, endpoint);
    }
    await fetch(base + "/");
    await fetch(base + "/health");
    await fetch(base + "/api/stats");
    await fetch(base + "/api/missing");
    await fetch(base + "/api/users", { method: "POST" });
    // Instrumentation is intentionally asynchronous after the API response.
    for (let attempt = 0; attempt < 20 && state.total !== 4; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(state.total, 4);
    const stats = await request(base, "/api/stats");
    assert.equal(stats.body.totalRequests, 4);
  }, { metricsProvider: async () => collection });
});

test("Invalid API IDs count as GET requests; 429 rejected requests are not counted", async () => {
  const { state, collection } = mockMetricsCollection();
  await withApp(async (base) => {
    assert.equal((await fetch(base + "/api/users/invalid")).status, 400);
    assert.equal((await fetch(base + "/api/todos")).status, 429);
    for (let attempt = 0; attempt < 20 && state.total !== 1; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(state.total, 1);
  }, {
    metricsProvider: async () => collection,
    rateLimitOptions: { limit: 1, windowMs: 60_000, isRender: false },
  });
});

test("Stats use safe JSON 503 on write-connection outages and never expose secrets", async () => {
  await withApp(async (base) => {
    const r = await request(base, "/api/stats");
    assert.equal(r.status, 503);
    assert.equal(r.body.error, "service_unavailable");
    assert.doesNotMatch(JSON.stringify(r.body), /secret-password/);
  }, { metricsProvider: async () => { throw Error("secret-password"); } });
});

test("Homepage includes the requested three-card statistics design and no sample count", async () => {
  await withApp(async (base) => {
    const html = await (await fetch(base + "/")).text();
    assert.ok(html.indexOf("overview-section") < html.indexOf("statistics-section"));
    assert.ok(html.indexOf("statistics-section") < html.indexOf("resources-section"));
    assert.match(html, /id="statistics"/);
    assert.match(html, /data-stat-total/);
    assert.match(html, /data-stat-started/);
    assert.match(html, /data-stat-copy/);
    assert.match(html, /Total API Requests/);
    assert.match(html, /Public Resources/);
    assert.match(html, /2<\/strong>/);
    assert.match(html, /MongoDB Atlas/);
    assert.match(html, /src="\/js\/statistics\.js"/);
    assert.doesNotMatch(html, /12,480/);
    const js = await (await fetch(base + "/js/statistics.js")).text();
    assert.match(js, /fetch\("\/api\/stats"/);
    assert.match(js, /intervalMs = 15000/);
    assert.match(js, /document\.hidden/);
    assert.match(js, /prefers-reduced-motion: reduce/);
    const css = await (await fetch(base + "/css/style.css")).text();
    assert.match(css, /\.statistics-grid\{display:grid/);
    assert.match(css, /@media\(max-width:650px\)\{\.statistics-section/);
  });
});

test("Stats endpoint is described in the OpenAPI contract as GET-only", async () => {
  await withApp(async (base) => {
    const spec = await (await fetch(base + "/openapi.json")).json();
    assert.deepEqual(Object.keys(spec.paths["/api/stats"]), ["get"]);
    assert.deepEqual(Object.keys(spec.paths["/api/stats"].get.responses).sort(), ["200", "429", "503"]);
    assert.deepEqual(spec.components.schemas.ApiStatistics.required, ["totalRequests", "startedAt"]);
    assert.equal(spec.components.schemas.ApiStatistics.additionalProperties, false);
  });
});


test("GET /statistics is a separate EJS page with home navigation", async () => {
  await withApp(async (base) => {
    const home = await (await fetch(base + "/")).text();
    const response = await fetch(base + "/statistics");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /html/);
    const html = await response.text();
    assert.match(home, /href="\/statistics"/);
    assert.match(home, /詳しい統計を見る/);
    assert.match(html, /id="dashboard-heading"/);
    assert.match(html, /data-dash-today/);
    assert.match(html, /data-dash-month/);
    assert.match(html, /data-dash-total/);
    assert.match(html, /data-dash-chart/);
    assert.match(html, /data-dash-endpoints/);
    assert.match(html, /src="\/js\/statistics-dashboard\.js"/);
    assert.match(html, /href="\/#overview"/);
    assert.match(html, /href="\/#endpoints"/);
    assert.match(html, /href="\/api\/stats\/details"/);
    assert.doesNotMatch(html, /12,480|架空の数値/);
  });
});

test("Detailed stats preserve legacy total and show zero for unrecorded breakdowns", async () => {
  const { collection } = mockMetricsCollection(123);
  await withApp(async (base) => {
    const r = await request(base, "/api/stats/details");
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.equal(r.body.totalRequests, 123);
    assert.equal(r.body.todayRequests, 0);
    assert.equal(r.body.monthRequests, 0);
    assert.equal(r.body.date, "2026-11-17");
    assert.equal(r.body.month, "2026-11");
    assert.equal(r.body.timezone, "Asia/Tokyo");
    assert.equal(r.body.last7Days.length, 7);
    assert.deepEqual(r.body.last7Days.map((x) => x.date), [
      "2026-11-11", "2026-11-12", "2026-11-13",
      "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17",
    ]);
    assert.ok(r.body.last7Days.every((x) => x.requests === 0));
    assert.deepEqual(r.body.endpoints, [
      { path: "GET /api/users", requests: 0 },
      { path: "GET /api/users/:id", requests: 0 },
      { path: "GET /api/todos", requests: 0 },
      { path: "GET /api/todos/:id", requests: 0 },
    ]);
  }, {
    metricsProvider: async () => collection,
    metricsNow: () => new Date("2026-11-17T03:20:00Z"),
  });
});

test("Each GET is atomically recorded for daily JST, monthly and normalized endpoint keys", async () => {
  const { collection, state } = mockMetricsCollection(60);
  await withApp(async (base) => {
    for (const path of ["/api/users", "/api/users?status=active", "/api/users/" + ids[0],
                        "/api/todos", "/api/todos/" + ids[0]]) {
      assert.equal((await fetch(base + path)).status, 200);
    }
    for (let i = 0; i < 25 && state.total !== 65; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(state.total, 65);
    assert.equal(state.daily["2026-11-17"], 5);
    assert.equal(state.monthly["2026-11"], 5);
    assert.deepEqual(state.byEndpoint, { usersList: 2, usersDetail: 1, todosList: 1, todosDetail: 1 });
    assert.equal(state.increments.length, 5);
    const details = await request(base, "/api/stats/details");
    assert.equal(details.body.totalRequests, 65);
    assert.equal(details.body.todayRequests, 5);
    assert.equal(details.body.monthRequests, 5);
    assert.deepEqual(details.body.endpoints.map((x) => x.requests), [2, 1, 1, 1]);
    assert.equal(details.body.last7Days.at(-1).requests, 5);
  }, {
    metricsProvider: async () => collection,
    metricsNow: () => new Date("2026-11-17T03:20:00Z"),
  });
});

test("JST date and month boundaries are independent of UTC server time", async () => {
  const { japanDateKey } = await import("../middleware/metrics.js");
  assert.equal(japanDateKey(new Date("2026-11-30T14:59:59.000Z")), "2026-11-30");
  assert.equal(japanDateKey(new Date("2026-11-30T15:00:00.000Z")), "2026-12-01");
  assert.equal(japanDateKey(new Date("2026-12-31T15:00:00.000Z")), "2027-01-01");
  const { state, collection } = mockMetricsCollection();
  let current = new Date("2026-11-30T14:59:59Z");
  await withApp(async (base) => {
    await fetch(base + "/api/users");
    for (let i = 0; i < 20 && state.total !== 1; i++) await new Promise((r) => setTimeout(r, 10));
    current = new Date("2026-11-30T15:00:00Z");
    await fetch(base + "/api/todos");
    for (let i = 0; i < 20 && state.total !== 2; i++) await new Promise((r) => setTimeout(r, 10));
    assert.deepEqual(state.daily, { "2026-11-30": 1, "2026-12-01": 1 });
    assert.deepEqual(state.monthly, { "2026-11": 1, "2026-12": 1 });
    const r = await request(base, "/api/stats/details");
    assert.equal(r.body.todayRequests, 1);
    assert.equal(r.body.monthRequests, 1);
    assert.equal(r.body.date, "2026-12-01");
    assert.equal(r.body.month, "2026-12");
  }, { metricsProvider: async () => collection, metricsNow: () => current });
});

test("Detailed stats polling does not change request totals, while 429 remains uncounted", async () => {
  const { state, collection } = mockMetricsCollection();
  await withApp(async (base) => {
    assert.equal((await fetch(base + "/api/users")).status, 200);
    assert.equal((await fetch(base + "/api/stats/details")).status, 429);
    for (let i = 0; i < 20 && state.total !== 1; i++) await new Promise((r) => setTimeout(r, 10));
    assert.equal(state.total, 1);
  }, { metricsProvider: async () => collection, rateLimitOptions: { limit: 1, windowMs: 60000, isRender: false } });
  await withApp(async (base) => {
    for (let i = 0; i < 4; i++) assert.equal((await fetch(base + "/api/stats/details")).status, 200);
  }, { metricsProvider: async () => collection });
  assert.equal(state.total, 1);
});

test("Detailed statistics fail closed and do not expose database errors", async () => {
  await withApp(async (base) => {
    const r = await request(base, "/api/stats/details");
    assert.equal(r.status, 503);
    assert.equal(r.body.error, "service_unavailable");
    assert.doesNotMatch(JSON.stringify(r.body), /top-secret-password/);
  }, { metricsProvider: async () => { throw new Error("top-secret-password"); } });
});

test("Dashboard script is visibility aware, safely renders text, and has mobile layout", async () => {
  await withApp(async (base) => {
    const js = await (await fetch(base + "/js/statistics-dashboard.js")).text();
    assert.match(js, /fetch\("\/api\/stats\/details"/);
    assert.match(js, /document\.hidden/);
    assert.match(js, /setInterval\(\(\) =>/);
    assert.match(js, /15000/);
    assert.match(js, /textContent = value/);
    assert.doesNotMatch(js, /innerHTML/);
    const css = await (await fetch(base + "/css/style.css")).text();
    assert.match(css, /\.dash-summary\{display:grid/);
    assert.match(css, /@media\(max-width:540px\)/);
  });
});

test("OpenAPI documents details as GET-only and validates its shape", async () => {
  const SwaggerParser = (await import("@apidevtools/swagger-parser")).default;
  await withApp(async (base) => {
    const spec = await (await fetch(base + "/openapi.json")).json();
    assert.deepEqual(Object.keys(spec.paths["/api/stats/details"]), ["get"]);
    assert.deepEqual(Object.keys(spec.paths["/api/stats/details"].get.responses).sort(), ["200", "429", "503"]);
    assert.equal(spec.components.schemas.DetailedApiStatistics.additionalProperties, false);
    const validated = await SwaggerParser.validate(spec);
    assert.equal(validated.openapi, "3.1.0");
  });
});


test("Usage menu navigates to a dedicated EJS page with all nine GET examples", async () => {
  await withApp(async (base) => {
    const home = await (await fetch(base + "/")).text();
    assert.match(home, /<a href="\/examples"><svg/);
    assert.match(home, /class="[^"]*example-teaser-button[^"]*" href="\/examples"/);
    const response = await fetch(base + "/examples");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /html/);
    const html = await response.text();
    assert.match(html, /使い方・コードサンプル/);
    assert.match(html, /data-code-examples/);
    for (const endpoint of ["users", "users-active", "users-inactive", "user-id", "todos", "todo-id", "health", "stats", "stats-details"]) {
      assert.match(html, new RegExp('value="' + endpoint + '"'));
    }
    for (const language of ["javascript", "python", "curl"]) {
      assert.match(html, new RegExp('data-sample-language="' + language + '"'));
    }
    assert.match(html, /data-sample-copy/);
    assert.match(html, /src="\/js\/code-examples\.js"/);
    assert.match(html, /role="tablist"/);
    assert.match(html, /href="\/#try-api"/);
    assert.doesNotMatch(html, /API_SECRET|MONGODB_URI|secret-password/);
  });
});

test("Usage page and client asset work without MongoDB and do not affect API metrics", async () => {
  const { collection, state } = mockMetricsCollection(30);
  await withApp(async (base) => {
    const paths = ["/examples", "/js/code-examples.js", "/"];
    for (const path of paths) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200);
    }
    assert.equal(state.total, 30);
    const response = await fetch(base + "/examples", { method: "POST" });
    assert.equal(response.status, 404);
  }, { configured: false, metricsProvider: async () => collection });
});

test("Code examples client switches languages and validates IDs before copy", async () => {
  const { runInNewContext } = await import("node:vm");
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../public/js/code-examples.js", import.meta.url), "utf8");
  const makeElement = (properties = {}) => ({
    textContent: "", dataset: {}, hidden: false, disabled: false, tabIndex: 0, value: "",
    attributes: {}, handlers: {},
    addEventListener(type, callback) { this.handlers[type] = callback; },
    setAttribute(key, value) { this.attributes[key] = value; },
    focus() { this.focused = true; },
    ...properties,
  });
  const selector = makeElement({ value: "users" });
  const objectId = makeElement();
  const objectField = makeElement({ hidden: true });
  const hint = makeElement();
  const request = makeElement();
  const code = makeElement();
  const copy = makeElement();
  const copyLabel = makeElement();
  const panel = makeElement();
  const tabs = ["javascript", "python", "curl"].map((language) => makeElement({
    id: "sample-tab-" + language, dataset: { sampleLanguage: language },
  }));
  const lookup = new Map([
    ["[data-sample-endpoint]", selector],
    ["[data-sample-id]", objectId],
    ["[data-sample-id-field]", objectField],
    ["[data-sample-hint]", hint],
    ["[data-sample-request]", request],
    ["[data-sample-code]", code],
    ["[data-sample-copy]", copy],
    ["[data-sample-copy-label]", copyLabel],
    ['[role="tabpanel"]', panel],
  ]);
  const root = {
    querySelector: (key) => lookup.get(key),
    querySelectorAll: (key) => key === "[data-sample-language]" ? tabs : [],
  };
  const copied = [];
  runInNewContext(source, {
    document: { querySelector: (key) => key === "[data-code-examples]" ? root : null },
    navigator: { clipboard: { writeText: async (text) => { copied.push(text); } } },
    setTimeout: () => 1,
    clearTimeout: () => {},
  });
  assert.match(code.textContent, /^const response = await fetch/);
  assert.match(code.textContent, /https:\/\/ai-workspace-api-327r\.onrender\.com\/api\/users/);
  assert.equal(tabs[0].attributes["aria-selected"], "true");
  tabs[1].handlers.click();
  assert.match(code.textContent, /from urllib.request import urlopen/);
  assert.match(code.textContent, /\/api\/users/);
  assert.equal(panel.attributes["aria-labelledby"], "sample-tab-python");
  tabs[2].handlers.keydown({ key: "Home", preventDefault() {} });
  assert.equal(tabs[0].focused, true);
  assert.equal(tabs[0].attributes["aria-selected"], "true");

  selector.value = "user-id";
  selector.handlers.change();
  assert.equal(objectField.hidden, false);
  assert.equal(copy.disabled, true);
  assert.doesNotMatch(code.textContent, /fetch\(/);
  objectId.value = '";alert(1);//';
  objectId.handlers.input();
  assert.equal(copy.disabled, true);

  objectId.value = "6afaa9fb021f207d9648f5ad";
  objectId.handlers.input();
  assert.equal(copy.disabled, false);
  assert.equal(request.textContent, "/api/users/6afaa9fb021f207d9648f5ad");
  assert.match(code.textContent, /6afaa9fb021f207d9648f5ad/);
  await copy.handlers.click();
  assert.equal(copied.length, 1);
  assert.equal(copied[0], code.textContent);

  tabs[2].handlers.click();
  assert.match(code.textContent, /^curl --fail-with-body/);
  assert.match(code.textContent, /\/api\/users\/6afaa9fb021f207d9648f5ad/);
  selector.value = "stats-details";
  selector.handlers.change();
  assert.equal(objectField.hidden, true);
  assert.match(code.textContent, /\/api\/stats\/details/);
  assert.match(code.textContent, /--location/);
});

test("Usage sample interface supports copy failure and responsive mobile styles", async () => {
  await withApp(async (base) => {
    const source = await (await fetch(base + "/js/code-examples.js")).text();
    assert.match(source, /navigator\.clipboard\.writeText\(content\)/);
    assert.match(source, /copyLabel\.textContent = "コピーできません"/);
    assert.match(source, /copy\.disabled = !validCode/);
    assert.match(source, /role="tabpanel"|aria-labelledby/);
    assert.match(source, /textContent = validCode/);
    assert.doesNotMatch(source, /innerHTML/);
    const css = await (await fetch(base + "/css/style.css")).text();
    assert.match(css, /\.samples-layout\{display:grid/);
    assert.match(css, /@media\(max-width:650px\)\{\.samples-hero-inner/);
    assert.match(css, /\.samples-language-tabs button:focus-visible/);
  });
});


test("Access logs record successful, invalid, missing, limited and health requests", async () => {
  const recorded = [];
  let tick = 0;
  const accessLogOptions = {
    write: (line) => recorded.push(JSON.parse(line)),
    now: () => new Date("2026-11-17T12:34:56.789Z"),
    monotonic: () => ++tick * 1.25,
  };
  await withApp(async (base) => {
    assert.equal((await fetch(base + "/health")).status, 200);
    assert.equal((await fetch(base + "/api/users?status=active&token=VERY_PRIVATE_VALUE")).status, 200);
    assert.equal((await fetch(base + "/api/users/" + ids[0])).status, 200);
    assert.equal((await fetch(base + "/api/users/not-an-id?password=PRIVATE_PASSWORD")).status, 429);
    assert.equal((await fetch(base + "/api/anything/VERY_PRIVATE_VALUE")).status, 429);
    assert.equal((await fetch(base + "/examples")).status, 200);
    assert.equal((await fetch(base + "/")).status, 200);
    assert.equal((await fetch(base + "/swagger")).status, 200);
    assert.equal((await fetch(base + "/api/stats")).status, 429);
  }, { accessLogOptions, rateLimitOptions: { limit: 2, windowMs: 60_000, isRender: false } });
  assert.equal(recorded.length, 6);
  assert.deepEqual(recorded.map(({ endpoint, statusCode }) => [endpoint, statusCode]), [
    ["/health", 200],
    ["/api/users", 200],
    ["/api/users/:id", 200],
    ["/api/users/:id", 429],
    ["/api/*", 429],
    ["/api/stats", 429],
  ]);
  for (const entry of recorded) {
    assert.deepEqual(Object.keys(entry), [
      "event", "timestamp", "method", "endpoint", "statusCode", "durationMs", "aborted",
    ]);
    assert.equal(entry.event, "api_access");
    assert.equal(entry.timestamp, "2026-11-17T12:34:56.789Z");
    assert.ok(entry.durationMs >= 0);
    assert.equal(entry.aborted, false);
  }
  const json = JSON.stringify(recorded);
  assert.doesNotMatch(json, /PRIVATE_PASSWORD|VERY_PRIVATE_VALUE|token=|password=|6afaa9fb021f207d9648f5ad|cf-connecting-ip|198.51.100/);
});

test("Access logs retain real HTTP status for 400, 404, 503, stats and disallowed methods", async () => {
  const records = [];
  await withApp(async (base) => {
    assert.equal((await fetch(base + "/api/users/not-valid")).status, 400);
    assert.equal((await fetch(base + "/api/unknown/secret")).status, 404);
    assert.equal((await fetch(base + "/api/todos", { method: "POST" })).status, 404);
    assert.equal((await fetch(base + "/api/users")).status, 503);
    assert.equal((await fetch(base + "/api/stats")).status, 200);
    assert.equal((await fetch(base + "/api/stats/details")).status, 200);
  }, {
    provider: async () => { throw Error("fake-db-secret"); },
    accessLogOptions: { write: (line) => records.push(JSON.parse(line)) },
  });
  assert.deepEqual(records.map((r) => [r.method, r.endpoint, r.statusCode]), [
    ["GET", "/api/users/:id", 400],
    ["GET", "/api/*", 404],
    ["POST", "/api/todos", 404],
    ["GET", "/api/users", 503],
    ["GET", "/api/stats", 200],
    ["GET", "/api/stats/details", 200],
  ]);
  assert.doesNotMatch(JSON.stringify(records), /fake-db-secret/);
});

test("Access logger records aborted connections once and ignores writer failures", async () => {
  const { createAccessLogger, normalizedApiPath } = await import("../middleware/accessLogger.js");
  const { EventEmitter } = await import("node:events");
  assert.equal(normalizedApiPath("/api", "/users/" + ids[0]), "/api/users/:id");
  assert.equal(normalizedApiPath("/api", "/todos/" + ids[0]), "/api/todos/:id");
  assert.equal(normalizedApiPath("/api", "/stats/details"), "/api/stats/details");
  assert.equal(normalizedApiPath("/api", "/secret?token=hidden"), "/api/*");
  const events = [];
  const middleware = createAccessLogger({
    write: (line) => events.push(JSON.parse(line)),
    now: () => new Date("2026-11-17T00:00:00Z"),
    monotonic: (() => { let t = 0; return () => ++t * 4; })(),
  });
  const response = new EventEmitter();
  response.statusCode = 200;
  response.writableFinished = false;
  let nextCalled = false;
  middleware({ method: "GET", baseUrl: "/api", path: "/users/token-SECRET" }, response, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  response.emit("close");
  response.emit("finish");
  assert.equal(events.length, 1);
  assert.equal(events[0].aborted, true);
  assert.equal(events[0].statusCode, null);
  assert.equal(events[0].endpoint, "/api/users/:id");
  assert.equal(events[0].durationMs, 4);
  assert.doesNotMatch(JSON.stringify(events), /token-SECRET/);

  const failure = createAccessLogger({ write: () => { throw new Error("writer failed"); } });
  const okResponse = new EventEmitter();
  okResponse.statusCode = 200;
  okResponse.writableFinished = true;
  failure({ method: "GET", baseUrl: "/health", path: "/" }, okResponse, () => {});
  assert.doesNotThrow(() => {
    okResponse.emit("finish");
    okResponse.emit("close");
  });
});

test("Access logs do not interfere with existing MongoDB metrics counters", async () => {
  const { collection, state } = mockMetricsCollection(10);
  const lines = [];
  await withApp(async (base) => {
    assert.equal((await fetch(base + "/health")).status, 200);
    assert.equal((await fetch(base + "/api/users")).status, 200);
    assert.equal((await fetch(base + "/api/stats/details")).status, 200);
    assert.equal((await fetch(base + "/api/unknown")).status, 404);
    for (let i = 0; i < 20 && state.total !== 11; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(state.total, 11);
    assert.equal(lines.length, 4);
  }, {
    metricsProvider: async () => collection,
    accessLogOptions: { write: (line) => lines.push(JSON.parse(line)) },
  });
});


function fakeVisitorCollection() {
  const records = new Map();
  let updates = 0;
  return {
    records,
    get updates() { return updates; },
    async updateOne(query, update, options) {
      assert.equal(options.upsert, true);
      assert.ok(!query._id.includes("6afaa9fb"));
      assert.ok(update.$setOnInsert.period.startsWith("day:") || update.$setOnInsert.period.startsWith("month:"));
      assert.ok(update.$setOnInsert.expiresAt instanceof Date);
      if (!records.has(query._id)) records.set(query._id, { ...query, ...update.$setOnInsert });
      updates++;
    },
    async countDocuments(query) {
      return [...records.values()].filter((r) => r.period === query.period).length;
    },
  };
}

test("Website visitor statistics require opt-in reports and keep API metrics unchanged", async () => {
  const visitor = fakeVisitorCollection();
  const { collection: metrics, state } = mockMetricsCollection(77);
  const UUID_A = "e13d2136-70ee-46ca-86e1-dcc733fc1e89";
  const UUID_B = "991a5163-b86e-4f69-ae74-cb8c3ea4baff";
  await withApp(async (base) => {
    const before = await request(base, "/api/stats/visitors");
    assert.equal(before.status, 200);
    assert.deepEqual(before.body, {
      todayVisitors: 0, monthVisitors: 0, date: "2026-11-17",
      month: "2026-11", timezone: "Asia/Tokyo", measurement: "consented_browsers",
    });
    assert.equal(before.headers.get("cache-control"), "no-store");
    const visit = async (visitorId) => fetch(base + "/visitor/collect", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({ visitorId }),
    });
    assert.equal((await visit(UUID_A)).status, 204);
    assert.equal((await visit(UUID_A)).status, 204);
    assert.equal((await visit(UUID_B)).status, 204);
    const after = await request(base, "/api/stats/visitors");
    assert.equal(after.body.todayVisitors, 2);
    assert.equal(after.body.monthVisitors, 2);
    assert.equal(visitor.records.size, 4);
    assert.equal(visitor.updates, 6);
    assert.ok([...visitor.records.values()].every((v) => /^[0-9a-f]{64}$/.test(v._id.split(":").at(-1))));
    assert.doesNotMatch(JSON.stringify([...visitor.records.values()]), /e13d2136|991a5163/);
    assert.equal(state.total, 77);
    const classic = await request(base, "/api/stats");
    assert.equal(classic.body.totalRequests, 77);
  }, {
    metricsProvider: async () => metrics,
    visitorProvider: async () => visitor,
    visitorNow: () => new Date("2026-11-17T04:00:00Z"),
  });
});

test("Visitor day and month distinct counts roll over in JST independently", async () => {
  const visitor = fakeVisitorCollection();
  let instant = new Date("2026-11-30T14:59:58Z");
  const token = "e13d2136-70ee-46ca-86e1-dcc733fc1e89";
  await withApp(async (base) => {
    const post = async () => fetch(base + "/visitor/collect", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: token }),
    });
    assert.equal((await post()).status, 204);
    instant = new Date("2026-11-30T15:00:01Z");
    assert.equal((await post()).status, 204);
    const stat = await request(base, "/api/stats/visitors");
    assert.equal(stat.body.date, "2026-12-01");
    assert.equal(stat.body.month, "2026-12");
    assert.equal(stat.body.todayVisitors, 1);
    assert.equal(stat.body.monthVisitors, 1);
    assert.equal(visitor.records.size, 4);
    assert.ok([...visitor.records.values()].every((doc) => doc.expiresAt > instant));
  }, { visitorProvider: async () => visitor, visitorNow: () => instant });
});

test("Visitor capture rejects invalid IDs and untrusted origins without database writes", async () => {
  const visitor = fakeVisitorCollection();
  await withApp(async (base) => {
    const post = (value, headers = {}) => fetch(base + "/visitor/collect", {
      method: "POST", headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ visitorId: value }),
    });
    for (const id of ["", "nope", "e13d2136-70ee-46ca-86e1-dcc733fc1e8X", "00000000-0000-0000-0000-000000000000"]) {
      assert.equal((await post(id)).status, 400);
    }
    assert.equal((await post("e13d2136-70ee-46ca-86e1-dcc733fc1e89", { Origin: "https://evil.invalid" })).status, 403);
    assert.equal((await post("e13d2136-70ee-46ca-86e1-dcc733fc1e89", { "Sec-Fetch-Site": "cross-site" })).status, 403);
    assert.equal((await fetch(base + "/visitor/collect", { method: "POST", body: "visitorId=abc" })).status, 400);
    assert.equal((await fetch(base + "/visitor/collect", { method: "GET" })).status, 404);
    assert.equal(visitor.updates, 0);
  }, { visitorProvider: async () => visitor });
});

test("Visitor stats and registration fail safely on database outage", async () => {
  await withApp(async (base) => {
    const r = await request(base, "/api/stats/visitors");
    assert.equal(r.status, 503);
    assert.equal(r.body.error, "service_unavailable");
    assert.doesNotMatch(JSON.stringify(r.body), /secret-password/);
    const post = await fetch(base + "/visitor/collect", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: "e13d2136-70ee-46ca-86e1-dcc733fc1e89" }),
    });
    assert.equal(post.status, 503);
    assert.doesNotMatch(await post.text(), /secret-password/);
  }, { visitorProvider: async () => { throw Error("secret-password"); } });
});

test("Visitor consent is explicit, revocable and respects GPC or DNT", async () => {
  await withApp(async (base) => {
    const html = await (await fetch(base + "/statistics")).text();
    assert.match(html, /data-visitor-today/);
    assert.match(html, /data-visitor-month/);
    assert.match(html, /data-visitor-consent/);
    assert.match(html, /data-visitor-settings/);
    assert.match(html, /同意して計測する/);
    assert.match(html, /追跡拒否設定/);
    assert.match(html, /src="\/js\/visitor-consent.js"/);
    const src = await (await fetch(base + "/js/visitor-consent.js")).text();
    assert.match(src, /navigator\.globalPrivacyControl/);
    assert.match(src, /navigator\.doNotTrack/);
    assert.match(src, /crypto\.randomUUID/);
    assert.match(src, /safeDelete\(idKey\)/);
    assert.match(src, /fetch\("\/visitor\/collect"/);
    assert.ok(src.indexOf('if (consent === "yes"') > src.indexOf('allow.addEventListener'));
    const stats = await (await fetch(base + "/js/visitor-statistics.js")).text();
    assert.match(stats, /fetch\("\/api\/stats\/visitors"/);
    assert.match(stats, /document\.hidden/);
    const css = await (await fetch(base + "/css/style.css")).text();
    assert.match(css, /\.visitor-summary\{display:grid/);
    assert.match(css, /@media\(max-width:650px\)\{\.visitor-statistics/);
  });
});

test("Visitor endpoint is GET-only and documented by OpenAPI 3.1", async () => {
  const SwaggerParser = (await import("@apidevtools/swagger-parser")).default;
  await withApp(async (base) => {
    const spec = await (await fetch(base + "/openapi.json")).json();
    assert.deepEqual(Object.keys(spec.paths["/api/stats/visitors"]), ["get"]);
    assert.deepEqual(Object.keys(spec.paths["/api/stats/visitors"].get.responses).sort(), ["200", "429", "503"]);
    assert.equal(spec.components.schemas.WebsiteVisitorStatistics.additionalProperties, false);
    assert.equal((await SwaggerParser.validate(spec)).openapi, "3.1.0");
  });
});


test("Social share metadata is rendered server-side on all public HTML pages", async () => {
  const pages = [
    { path: "/", canonical: "/", title: "AI Workspace API | 学んで試せるREST API" },
    { path: "/statistics", canonical: "/statistics", title: "統計ダッシュボード | AI Workspace API" },
    { path: "/examples", canonical: "/examples", title: "APIコードサンプル | AI Workspace API" },
    { path: "/swagger", canonical: "/swagger", title: "Swagger UI | AI Workspace API" },
    { path: "/swagger/", canonical: "/swagger", title: "Swagger UI | AI Workspace API" },
  ];
  await withApp(async (base) => {
    for (const { path, canonical, title } of pages) {
      const res = await fetch(base + path, { headers: { "User-Agent": "Twitterbot/1.0" } });
      assert.equal(res.status, 200, path);
      assert.match(res.headers.get("content-type"), /text\/html/);
      const html = await res.text();
      const head = html.split("</head>")[0];
      const origin = "https://ai-workspace-api-327r.onrender.com";
      assert.ok(head.includes('<meta property="og:title" content="' + title + '">'), path);
      assert.ok(head.includes('<meta name="twitter:title" content="' + title + '">'), path);
      assert.ok(head.includes('<link rel="canonical" href="' + origin + canonical + '">'), path);
      assert.ok(head.includes('<meta property="og:url" content="' + origin + canonical + '">'), path);
      assert.ok(head.includes('<meta property="og:image" content="' + origin + '/social-card.png">'), path);
      assert.ok(head.includes('<meta name="twitter:image" content="' + origin + '/social-card.png">'), path);
      assert.ok(head.includes('<meta name="twitter:card" content="summary_large_image">'), path);
      assert.ok(head.includes('<meta property="og:image:type" content="image/png">'), path);
      assert.ok(head.includes('<meta property="og:image:width" content="1200">'), path);
      assert.ok(head.includes('<meta property="og:image:height" content="630">'), path);
      assert.ok(head.includes('<meta property="og:locale" content="ja_JP">'), path);
      assert.ok(head.includes('<meta property="og:image:alt"'), path);
      assert.ok(head.includes('<meta name="twitter:image:alt"'), path);
      assert.ok(head.includes('<meta property="og:description" content="'), path);
      assert.ok(head.includes('<meta name="description" content="'), path);
      assert.equal((head.match(/property="og:image" /g) || []).length, 1, path);
      assert.doesNotMatch(head, /localhost|127\.0\.0\.1|&amp;#|<script[^>]*>.*og:image/);
    }
  });
});

test("Social card is a public valid 1200x630 PNG served quickly and cached", async () => {
  const sharp = (await import("sharp")).default;
  await withApp(async (base) => {
    const first = await fetch(base + "/social-card.png", {
      headers: { "User-Agent": "facebookexternalhit/1.1" },
    });
    assert.equal(first.status, 200);
    assert.match(first.headers.get("content-type"), /image\/png/);
    assert.equal(first.headers.get("x-content-type-options"), "nosniff");
    assert.match(first.headers.get("cache-control") || "", /public/);
    const data = Buffer.from(await first.arrayBuffer());
    assert.ok(data.length > 10_000 && data.length < 5_000_000);
    assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    const info = await sharp(data).metadata();
    assert.equal(info.width, 1200);
    assert.equal(info.height, 630);
    assert.equal(info.format, "png");
    const other = await fetch(base + "/social-card.png");
    assert.equal(other.status, 200);
    assert.deepEqual(Buffer.from(await other.arrayBuffer()), data);
    assert.equal((await fetch(base + "/social-card.svg")).status, 200);
  }, { configured: false });
});

test("Social preview endpoints do not modify existing API counters or need database", async () => {
  const { collection, state } = mockMetricsCollection(29);
  await withApp(async (base) => {
    const paths = ["/", "/statistics", "/examples", "/swagger", "/swagger/", "/social-card.png"];
    for (const path of paths) assert.equal((await fetch(base + path)).status, 200, path);
    assert.equal(state.total, 29);
    const stats = await request(base, "/api/stats");
    assert.equal(stats.status, 200);
    assert.equal(stats.body.totalRequests, 29);
  }, { configured: false, metricsProvider: async () => collection });
});
