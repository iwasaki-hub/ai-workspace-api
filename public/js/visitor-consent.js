"use strict";

/**
 * Site-only, opt-in anonymous browser counting. No cookies, no IP collection.
 * localStorage identifier is generated only after explicit user consent.
 */
(() => {
  const panel = document.querySelector("[data-visitor-consent]");
  if (!panel) return;
  const status = panel.querySelector("[data-visitor-consent-text]");
  const allow = panel.querySelector("[data-visitor-allow]");
  const decline = panel.querySelector("[data-visitor-decline]");
  const settings = document.querySelector("[data-visitor-settings]");
  const key = "aiworkspace.visitor.consent.v1";
  const idKey = "aiworkspace.visitor.id.v1";
  const restricted = navigator.globalPrivacyControl === true || navigator.doNotTrack === "1";

  function safeRead(name) {
    try { return localStorage.getItem(name); } catch { return null; }
  }
  function safeSave(name, value) {
    try { localStorage.setItem(name, value); return true; } catch { return false; }
  }
  function safeDelete(name) {
    try { localStorage.removeItem(name); } catch { /* storage unavailable */ }
  }

  function showSettings() {
    panel.hidden = false;
    if (restricted) {
      status.textContent = "ブラウザの追跡拒否設定を尊重し、訪問者数の計測は行いません。";
      allow.hidden = true;
      decline.textContent = "閉じる";
    } else {
      status.textContent = "匿名のブラウザ識別子を端末内に保存し、今日と今月の重複しない訪問数を集計します。IPアドレスや識別子そのものはDBへ保存しません。いつでも停止できます。";
      allow.hidden = false;
      decline.textContent = "同意しない・停止";
    }
  }

  async function countVisit() {
    if (restricted || safeRead(key) !== "yes") return;
    let visitorId = safeRead(idKey);
    if (!visitorId) {
      if (!globalThis.crypto?.randomUUID) return;
      visitorId = globalThis.crypto.randomUUID();
      if (!safeSave(idKey, visitorId)) return;
    }
    try {
      await fetch("/visitor/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ visitorId }),
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(12000),
      });
    } catch { /* Best-effort measurement, never block page use */ }
  }

  allow.addEventListener("click", () => {
    if (restricted) return;
    if (!safeSave(key, "yes")) return;
    panel.hidden = true;
    void countVisit();
  });
  decline.addEventListener("click", () => {
    safeDelete(idKey);
    safeSave(key, "no");
    panel.hidden = true;
  });
  settings?.addEventListener("click", showSettings);

  const consent = safeRead(key);
  if (consent === "yes" && !restricted) void countVisit();
  else if (consent !== "no" && !restricted) showSettings();
})();
