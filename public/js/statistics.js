"use strict";

/**
 * Live API statistics with visibility-aware polling.
 * Never show invented totals. Counts start only when the Atlas counter is initialized.
 */
(() => {
  const total = document.querySelector("[data-stat-total]");
  if (!total) return;
  const started = document.querySelector("[data-stat-started]");
  const updated = document.querySelector("[data-stat-updated]");
  const copy = document.querySelector("[data-stat-copy]");
  const copyLabel = document.querySelector("[data-stat-copy-label]");
  const url = document.querySelector("[data-stat-url]");
  const intervalMs = 15000;
  let timer = null;
  let lastTotal = null;
  let inFlight = false;

  function showCount(next) {
    const motion = window.Motion;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canAnimate = motion && typeof motion.animate === "function" && !reduced
      && Number.isSafeInteger(lastTotal) && next !== lastTotal;
    if (canAnimate) {
      motion.animate(lastTotal, next, {
        duration: 0.65, ease: "easeOut",
        onUpdate: (value) => { total.textContent = Math.round(value).toLocaleString("ja-JP"); },
      });
    } else {
      total.textContent = next.toLocaleString("ja-JP");
    }
    lastTotal = next;
  }

  async function refresh() {
    if (inFlight || document.hidden) return;
    inFlight = true;
    try {
      const response = await fetch("/api/stats", {
        headers: { Accept: "application/json" },
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error("stats not available");
      const data = await response.json();
      if (!Number.isSafeInteger(data.totalRequests) || data.totalRequests < 0 ||
          !data.startedAt || Number.isNaN(Date.parse(data.startedAt))) {
        throw new Error("invalid statistics");
      }
      showCount(data.totalRequests);
      started.dateTime = data.startedAt;
      started.textContent = new Intl.DateTimeFormat("ja-JP", {
        year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tokyo",
      }).format(new Date(data.startedAt));
      updated.textContent = "最終更新: " + new Intl.DateTimeFormat("ja-JP", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      }).format(new Date());
    } catch {
      if (lastTotal === null) total.textContent = "—";
      updated.textContent = "利用状況を取得できません";
      if (!started.dateTime) started.textContent = "確認できません";
    } finally {
      inFlight = false;
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
    timer = setInterval(() => { void refresh(); }, intervalMs);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
  window.addEventListener("pagehide", stop);

  if (copy && url) {
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(url.textContent.trim());
        copyLabel.textContent = "コピーしました ✓";
      } catch {
        copyLabel.textContent = "コピーできません";
      }
      setTimeout(() => { copyLabel.textContent = "コピー"; }, 1800);
    });
  }

  start();
})();
