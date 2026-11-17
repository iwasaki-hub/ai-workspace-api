"use strict";

(() => {
  const today = document.querySelector("[data-visitor-today]");
  if (!today) return;
  const month = document.querySelector("[data-visitor-month]");
  const status = document.querySelector("[data-visitor-status]");
  let timer = null;
  let loading = false;
  let hasData = false;

  async function refresh() {
    if (document.hidden || loading) return;
    loading = true;
    try {
      const response = await fetch("/api/stats/visitors", {
        headers: { Accept: "application/json" },
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error("not available");
      const data = await response.json();
      if (data.measurement !== "consented_browsers" ||
          data.timezone !== "Asia/Tokyo" ||
          !Number.isSafeInteger(data.todayVisitors) || data.todayVisitors < 0 ||
          !Number.isSafeInteger(data.monthVisitors) || data.monthVisitors < data.todayVisitors) {
        throw new Error("invalid visitor metrics");
      }
      today.textContent = data.todayVisitors.toLocaleString("ja-JP");
      month.textContent = data.monthVisitors.toLocaleString("ja-JP");
      status.textContent = "JST・約15秒ごとに更新";
      hasData = true;
    } catch {
      if (!hasData) {
        today.textContent = "—";
        month.textContent = "—";
      }
      status.textContent = "訪問者数を取得できません";
    } finally {
      loading = false;
    }
  }
  function stop() {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }
  function start() {
    stop();
    if (document.hidden) return;
    void refresh();
    timer = setInterval(() => { void refresh(); }, 15000);
  }
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  window.addEventListener("pagehide", stop);
  start();
})();