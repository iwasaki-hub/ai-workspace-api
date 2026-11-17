"use strict";

/**
 * Allowlisted, read-only API examples for the dedicated /examples page.
 * URLs are constructed from fixed endpoints and a validated ObjectId only.
 */
(() => {
  const root = document.querySelector("[data-code-examples]");
  if (!root) return;

  const BASE_URL = "https://ai-workspace-api-327r.onrender.com";
  const endpoints = Object.freeze({
    users: "/api/users",
    "users-active": "/api/users?status=active",
    "users-inactive": "/api/users?status=inactive",
    "user-id": "/api/users/",
    todos: "/api/todos",
    "todo-id": "/api/todos/",
    health: "/health",
    stats: "/api/stats",
    "stats-details": "/api/stats/details",
  });
  const languages = ["javascript", "python", "curl"];
  const selector = root.querySelector("[data-sample-endpoint]");
  const objectId = root.querySelector("[data-sample-id]");
  const objectField = root.querySelector("[data-sample-id-field]");
  const hint = root.querySelector("[data-sample-hint]");
  const request = root.querySelector("[data-sample-request]");
  const code = root.querySelector("[data-sample-code]");
  const copy = root.querySelector("[data-sample-copy]");
  const copyLabel = root.querySelector("[data-sample-copy-label]");
  const panel = root.querySelector('[role="tabpanel"]');
  const tabs = Array.from(root.querySelectorAll("[data-sample-language]"));
  let language = "javascript";
  let validCode = false;
  let feedbackTimeout;

  function chosenPath() {
    const choice = selector.value;
    if (!Object.hasOwn(endpoints, choice)) return null;
    const needsId = choice === "user-id" || choice === "todo-id";
    objectField.hidden = !needsId;
    if (!needsId) return endpoints[choice];
    const id = objectId.value.trim();
    if (!/^[0-9a-fA-F]{24}$/.test(id)) return null;
    return endpoints[choice] + id;
  }

  function sampleFor(path) {
    const url = BASE_URL + path;
    if (language === "javascript") {
      return [
        'const response = await fetch(' + JSON.stringify(url) + ');',
        'if (!response.ok) throw new Error("HTTP " + response.status);',
        'const data = await response.json();',
        "console.log(data);",
      ].join("\n");
    }
    if (language === "python") {
      return [
        "import json",
        "from urllib.request import urlopen",
        "",
        "with urlopen(" + JSON.stringify(url) + ", timeout=15) as response:",
        '    data = json.load(response)',
        "",
        "print(data)",
      ].join("\n");
    }
    return "curl --fail-with-body --show-error --silent --location --max-time 15 '" + url + "'";
  }

  function render() {
    const path = chosenPath();
    validCode = path !== null;
    const needsId = selector.value === "user-id" || selector.value === "todo-id";
    request.textContent = path || (endpoints[selector.value] || "不明なエンドポイント") + (needsId ? ":id" : "");
    code.textContent = validCode ? sampleFor(path) : "一覧から取得した24桁のObjectIdを入力すると、実行可能なサンプルコードが表示されます。";
    copy.disabled = !validCode;
    hint.textContent = validCode
      ? "公開GET APIです。コピーしたコードから実際のリクエストを送れます。"
      : "24桁の16進数のObjectIdを入力してください。";
    hint.dataset.invalid = String(!validCode);
    copyLabel.textContent = "コードをコピー";
    for (const tab of tabs) {
      const selected = tab.dataset.sampleLanguage === language;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) panel.setAttribute("aria-labelledby", tab.id);
    }
  }

  function selectTab(next) {
    if (!languages.includes(next)) return;
    language = next;
    render();
  }

  selector.addEventListener("change", render);
  objectId.addEventListener("input", render);
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => selectTab(tab.dataset.sampleLanguage));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const current = languages.indexOf(tab.dataset.sampleLanguage);
      let index = current;
      if (event.key === "Home") index = 0;
      else if (event.key === "End") index = languages.length - 1;
      else index = (current + (event.key === "ArrowRight" ? 1 : -1) + languages.length) % languages.length;
      selectTab(languages[index]);
      tabs[index].focus();
    });
  });

  copy.addEventListener("click", async () => {
    if (!validCode) return;
    const content = code.textContent;
    try {
      await navigator.clipboard.writeText(content);
      copyLabel.textContent = "コピーしました ✓";
    } catch {
      copyLabel.textContent = "コピーできません";
    }
    clearTimeout(feedbackTimeout);
    feedbackTimeout = setTimeout(() => { copyLabel.textContent = "コードをコピー"; }, 1800);
  });

  render();
})();