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


test("GET /openapi.json is a valid OpenAPI contract matching implemented GET routes", async () => {
  const SwaggerParser = (await import("@apidevtools/swagger-parser")).default;
  await withApp(async (base) => {
    const response = await fetch(base + "/openapi.json");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", /application\/json/);
    const spec = await response.json();
    assert.equal(spec.openapi, "3.1.0");
    assert.equal(spec.info.title, "AI Workspace API");
    assert.deepEqual(Object.keys(spec.paths).sort(), ["/api/users", "/api/users/{id}", "/health"]);
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      assert.deepEqual(Object.keys(pathItem), ["get"], `No write operations in ${path}`);
      assert.ok(pathItem.get.responses["200"]);
      const url = path === "/api/users/{id}" ? "/api/users/" + ids[0] : path;
      const actual = await fetch(base + url);
      assert.equal(actual.status, 200, `documented GET ${url}`);
    }
    assert.deepEqual(Object.keys(spec.paths["/api/users"].get.responses).sort(), ["200", "400", "503"]);
    assert.deepEqual(Object.keys(spec.paths["/api/users/{id}"].get.responses).sort(), ["200", "400", "404", "503"]);
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
    assert.match(html, /href="#overview"[^>]*>\s*<svg/);
    assert.match(html, /href="#try-api"[^>]*>\s*<svg/);
    assert.match(html, /href="\/swagger"[^>]*>\s*<svg/);
    assert.match(html, /class="openapi-link openapi-link-primary" href="\/swagger"/);
    assert.match(html, /class="feature-icon"><svg/);
    assert.match(html, /data-copy-label/);
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
