"use strict";

/**
 * All animation timing and interaction choices are managed here.
 * Motion is the official npm browser bundle served locally by Express.
 * The original EJS content remains visible when JavaScript is disabled.
 */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduceMotion.matches) return;

  const motion = window.Motion;
  if (!motion || typeof motion.animate !== "function" || typeof motion.inView !== "function") {
    // Gracefully degrade if the library cannot load.
    return;
  }

  const { animate, inView, stagger } = motion;

  const timing = Object.freeze({
    hero: 0.7,
    reveal: 0.58,
    hover: 0.18,
    stagger: 0.085,
  });

  // Intro: a soft reveal, without changing layout or navigation behavior.
  const heroCopy = Array.from(document.querySelectorAll(
    ".hero-copy .eyebrow, .hero-copy h1, .hero-copy .hero-lead, .hero-actions, .hero-note",
  ));
  if (heroCopy.length) {
    animate(heroCopy, {
      opacity: [0, 1],
      y: [16, 0],
    }, { duration: timing.hero, delay: stagger(timing.stagger), ease: "easeOut" });
  }
  const preview = document.querySelector(".hero-visual");
  if (preview) {
    animate(preview, { opacity: [0, 1], y: [18, 0] }, {
      duration: 0.8,
      delay: 0.16,
      ease: "easeOut",
    });
  }

  // One-time viewport reveals; no hidden placeholders before JS runs.
  const revealTargets = document.querySelectorAll(
    ".feature-card, .resources-heading, .resource-row, #endpoints .section-heading, " +
    ".endpoint-card, .openapi-callout, #try-api .section-heading, .explorer-grid, " +
    ".example-intro, .example-editor, .roadmap-section .section-heading, .roadmap-item",
  );
  revealTargets.forEach((element, index) => {
    inView(element, () => {
      if (reduceMotion.matches) return;
      animate(element, { opacity: [0, 1], y: [18, 0] }, {
        duration: timing.reveal,
        delay: Math.min(index % 3, 2) * timing.stagger,
        ease: "easeOut",
      });
    }, { amount: 0.12, margin: "0px 0px -24px 0px" });
  });

  // Hover feedback only on devices that actually support hovering.
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    const hoverTargets = document.querySelectorAll(
      ".feature-card, .resource-row, .roadmap-item, .hero-actions .button, " +
      ".openapi-link, .explorer-submit",
    );
    hoverTargets.forEach((element) => {
      element.addEventListener("pointerenter", () => {
        if (reduceMotion.matches) return;
        animate(element, { y: -3, scale: 1.012 }, {
          duration: timing.hover, ease: "easeOut",
        });
      });
      element.addEventListener("pointerleave", () => {
        animate(element, { y: 0, scale: 1 }, {
          duration: timing.hover, ease: "easeOut",
        });
      });
    });
  }

  // Stop custom transforms immediately if the user enables reduced motion.
  reduceMotion.addEventListener?.("change", (event) => {
    if (!event.matches) return;
    document.querySelectorAll(".feature-card, .resource-row, .roadmap-item, " +
      ".hero-actions .button, .openapi-link, .explorer-submit").forEach((element) => {
      element.style.removeProperty("transform");
      element.style.removeProperty("opacity");
      element.style.removeProperty("translate");
      element.style.removeProperty("scale");
    });
  });
})();
