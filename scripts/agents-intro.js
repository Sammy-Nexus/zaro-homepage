(function () {
  const INTRO_DURATION_MS = 520;
  const ROW_STAGGER_MS = 42;
  const ROW_START_DELAY_MS = 230;

  const page = document.querySelector(".agents-page");
  if (!page) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const sections = [
    { selector: ".agents-page__topbar", variant: "top", delay: 0 },
    { selector: ".agents-page__header", variant: "rise", delay: 55 },
    { selector: ".agents-toolbar", variant: "rise", delay: 110 },
    { selector: ".agents-table-wrap", variant: "panel", delay: 170 },
  ];

  function clearIntroClasses() {
    page.classList.remove("agents-page--intro-active");
    page.querySelectorAll(".agents-intro-item").forEach((el) => {
      el.classList.remove(
        "agents-intro-item",
        "agents-intro-item--top",
        "agents-intro-item--rise",
        "agents-intro-item--panel"
      );
      el.style.removeProperty("--agents-intro-delay");
    });
  }

  function markIntroItem(el, variant, delay) {
    el.classList.add("agents-intro-item", `agents-intro-item--${variant}`);
    el.style.setProperty("--agents-intro-delay", `${delay}ms`);
  }

  function playIntro() {
    if (prefersReducedMotion) {
      page.classList.remove("agents-page--intro-pending");
      return;
    }

    clearIntroClasses();

    sections.forEach(({ selector, variant, delay }) => {
      const el = page.querySelector(selector);
      if (el) markIntroItem(el, variant, delay);
    });

    const rowTargets = [
      ...page.querySelectorAll(".agents-group__header"),
      ...page.querySelectorAll(".agents-row"),
    ];

    rowTargets.forEach((el, index) => {
      markIntroItem(
        el,
        "rise",
        ROW_START_DELAY_MS + index * ROW_STAGGER_MS
      );
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        page.classList.remove("agents-page--intro-pending");
        page.classList.add("agents-page--intro-active");
      });
    });

    const totalMs =
      INTRO_DURATION_MS +
      ROW_START_DELAY_MS +
      Math.max(0, rowTargets.length - 1) * ROW_STAGGER_MS +
      80;

    window.setTimeout(clearIntroClasses, totalMs);
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => requestAnimationFrame(playIntro),
      { once: true }
    );
  } else {
    requestAnimationFrame(playIntro);
  }
})();
