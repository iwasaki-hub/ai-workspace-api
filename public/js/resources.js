"use strict";

// The homepage shows the current number of publicly returned records.
// These GET requests use the same public API as the existing playground.
async function loadResourceCounts() {
  const counters = document.querySelectorAll("[data-resource-count]");
  for (const counter of counters) {
    const endpoint = counter.dataset.resourceCount;
    const maxCount = Number(counter.dataset.resourceMax || 50);
    if (!endpoint || !endpoint.startsWith("/") || endpoint.startsWith("//")) {
      counter.textContent = "—";
      continue;
    }
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "omit",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("resource unavailable");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("invalid resource response");
      counter.textContent = data.length >= maxCount
        ? `${data.length}件（上限）`
        : `${data.length}件`;
    } catch {
      counter.textContent = "取得できません";
    }
  }
}
if (document.querySelector("[data-resource-count]")) {
  loadResourceCounts();
}
