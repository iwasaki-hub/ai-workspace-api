"use strict";

/* Detail dashboard: real Atlas-backed counts, visible-tab polling, no fake data. */
(() => {
  const root = document.querySelector("[data-dash-today]");
  if (!root) return;
  const today = root;
  const month = document.querySelector("[data-dash-month]");
  const total = document.querySelector("[data-dash-total]");
  const updated = document.querySelector("[data-dash-updated]");
  const dateLabel = document.querySelector("[data-dash-date]");
  const monthLabel = document.querySelector("[data-dash-month-label]");
  const started = document.querySelector("[data-dash-started]");
  const chart = document.querySelector("[data-dash-chart]");
  const endpointList = document.querySelector("[data-dash-endpoints]");
  let timer = null;
  let fetching = false;
  let lastUpdated = false;
  const format = (value) => value.toLocaleString("ja-JP");
  const validCount = (value) => Number.isSafeInteger(value) && value >= 0;

  function makeText(tag, className, value) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = value;
    return el;
  }

  function renderChart(days) {
    chart.replaceChildren();
    const max = Math.max(1, ...days.map((day) => day.requests));
    days.forEach((day) => {
      const row = makeText("div", "dash-bar-row", "");
      const label = makeText("span", "dash-bar-label", day.date.slice(5).replace("-", "/"));
      const track = makeText("span", "dash-bar-track", "");
      const bar = makeText("span", "dash-bar-fill", "");
      bar.style.width = (day.requests / max * 100) + "%";
      bar.setAttribute("aria-hidden", "true");
      track.appendChild(bar);
      const number = makeText("strong", "dash-bar-number", format(day.requests));
      row.append(label, track, number);
      chart.appendChild(row);
    });
  }

  function renderEndpoints(items) {
    endpointList.replaceChildren();
    const sum = items.reduce((acc, item) => acc + item.requests, 0);
    items.forEach((item) => {
      const row = makeText("div", "dash-endpoint-row", "");
      const label = makeText("code", "", item.path);
      const value = makeText("strong", "", format(item.requests));
      const track = makeText("span", "dash-endpoint-track", "");
      const fill = makeText("span", "dash-endpoint-fill", "");
      fill.style.width = (sum ? item.requests / sum * 100 : 0) + "%";
      fill.setAttribute("aria-hidden", "true");
      track.appendChild(fill);
      row.append(label, value, track);
      endpointList.appendChild(row);
    });
  }

  async function refresh() {
    if (fetching || document.hidden) return;
    fetching = true;
    try {
      const response = await fetch("/api/stats/details", {
        headers: { Accept: "application/json" },
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error("statistics unavailable");
      const data = await response.json();
      if (!validCount(data.totalRequests) || !validCount(data.todayRequests) ||
          !validCount(data.monthRequests) || data.timezone !== "Asia/Tokyo" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
          !/^\d{4}-\d{2}$/.test(data.month) ||
          !data.startedAt || Number.isNaN(Date.parse(data.startedAt)) ||
          !Array.isArray(data.last7Days) || data.last7Days.length !== 7 ||
          !data.last7Days.every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.date) && validCount(day.requests)) ||
          !Array.isArray(data.endpoints) ||
          !data.endpoints.every((item) => typeof item.path === "string" && validCount(item.requests))) {
        throw new Error("invalid statistics response");
      }
      today.textContent = format(data.todayRequests);
      month.textContent = format(data.monthRequests);
      total.textContent = format(data.totalRequests);
      dateLabel.textContent = data.date + " JST";
      monthLabel.textContent = data.month + " JST";
      started.dateTime = data.startedAt;
      started.textContent = new Intl.DateTimeFormat("ja-JP", {
        dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo",
      }).format(new Date(data.startedAt));
      renderChart(data.last7Days);
      renderEndpoints(data.endpoints);
      updated.textContent = "最終更新 " + new Intl.DateTimeFormat("ja-JP", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      }).format(new Date());
      lastUpdated = true;
    } catch {
      updated.textContent = "統計データを取得できません";
      if (!lastUpdated) {
        chart.replaceChildren(makeText("p", "dash-error", "データの取得に失敗しました。"));
        endpointList.replaceChildren(makeText("p", "dash-error", "データの取得に失敗しました。"));
      }
    } finally {
      fetching = false;
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
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
  window.addEventListener("pagehide", stop);
  start();
})();
