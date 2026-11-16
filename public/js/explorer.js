"use strict";

const form = document.getElementById("api-explorer-form");
if (form) {
  const endpoint = document.getElementById("api-endpoint");
  const status = document.getElementById("api-status");
  const id = document.getElementById("api-id");
  const statusField = document.getElementById("status-field");
  const idField = document.getElementById("id-field");
  const pathDisplay = document.getElementById("api-request-path");
  const output = document.getElementById("api-response");
  const httpStatus = document.getElementById("api-http-status");
  const elapsed = document.getElementById("api-response-time");
  const send = document.getElementById("api-send");
  const copy = document.getElementById("api-copy-response");
  let lastJson = "";

  function requestPath() {
    switch (endpoint.value) {
      case "health": return "/health";
      case "status": return "/api/users?status=" + encodeURIComponent(status.value);
      case "id": return "/api/users/" + id.value.trim();
      default: return "/api/users";
    }
  }

  function syncForm() {
    statusField.hidden = endpoint.value !== "status";
    idField.hidden = endpoint.value !== "id";
    pathDisplay.textContent = requestPath();
  }

  endpoint.addEventListener("change", syncForm);
  status.addEventListener("change", syncForm);
  id.addEventListener("input", syncForm);
  syncForm();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (send.disabled) return;
    if (endpoint.value === "id" && !/^[0-9a-f]{24}$/i.test(id.value.trim())) {
      httpStatus.textContent = "入力エラー";
      httpStatus.dataset.kind = "error";
      output.textContent = "IDは24桁の16進数で入力してください。";
      return;
    }

    send.disabled = true;
    copy.disabled = true;
    lastJson = "";
    httpStatus.textContent = "送信中…";
    httpStatus.dataset.kind = "pending";
    output.textContent = "レスポンスを取得しています…";
    elapsed.textContent = "—";
    const started = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(requestPath(), {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "omit",
        redirect: "error",
        signal: controller.signal,
      });
      const raw = await response.text();
      let data;
      try { data = JSON.parse(raw); }
      catch { throw new Error("JSONレスポンスを解析できませんでした。"); }
      lastJson = JSON.stringify(data, null, 2);
      output.textContent = lastJson; // Never render untrusted API data as HTML.
      httpStatus.textContent = "HTTP " + response.status + (response.ok ? " OK" : " ERROR");
      httpStatus.dataset.kind = response.ok ? "success" : "error";
      copy.disabled = false;
    } catch (error) {
      output.textContent = error.name === "AbortError"
        ? "タイムアウトしました。再度お試しください。"
        : "通信エラー: " + error.message;
      httpStatus.textContent = "エラー";
      httpStatus.dataset.kind = "error";
    } finally {
      clearTimeout(timer);
      elapsed.textContent = Math.round(performance.now() - started) + " ms";
      send.disabled = false;
    }
  });

  copy.addEventListener("click", async () => {
    if (!lastJson) return;
    try {
      await navigator.clipboard.writeText(lastJson);
      copy.textContent = "コピーしました ✓";
    } catch {
      copy.textContent = "コピーできませんでした";
    }
    setTimeout(() => { copy.textContent = "JSONをコピー"; }, 1800);
  });
}
