"use strict";

const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".primary-nav");

if (menuButton && navigation) {
  let openedAtScrollY = 0;

  function setMenuOpen(isOpen) {
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "メニューを閉じる" : "メニューを開く");
    navigation.classList.toggle("is-open", isOpen);
    if (isOpen) openedAtScrollY = window.scrollY;
  }

  menuButton.addEventListener("click", () => {
    setMenuOpen(menuButton.getAttribute("aria-expanded") !== "true");
  });

  // Close the expanded mobile menu when the page actually moves.
  // A small tolerance avoids closing it on subpixel scroll adjustments.
  window.addEventListener("scroll", () => {
    if (menuButton.getAttribute("aria-expanded") !== "true") return;
    if (Math.abs(window.scrollY - openedAtScrollY) > 3) setMenuOpen(false);
  }, { passive: true });

  navigation.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenuOpen(false));
  });
}

document.querySelectorAll("[data-copy-target]").forEach((button) => {
  button.addEventListener("click", async () => {
    const source = document.getElementById(button.dataset.copyTarget);
    if (!source) return;
    const label = button.querySelector("[data-copy-label]") || button;
    const original = label.textContent;

    try {
      await navigator.clipboard.writeText(source.textContent.trim());
      label.textContent = "コピーしました ✓";
    } catch {
      label.textContent = "コピーできませんでした";
    }
    setTimeout(() => { label.textContent = original; }, 1800);
  });
});
