(function () {
  const INTRO_DURATION_MS = 500;
  const INTRO_STAGGER_MS = 42;

  const main = document.getElementById("main");
  const orbit = document.querySelector(".cards-orbit");
  if (!orbit) return;

  const cards = [...orbit.querySelectorAll(".category-card")];
  const replayBtn = document.getElementById("replay-intro-demo");
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  let introEndTimer = null;
  let isPlaying = false;

  function finishPending() {
    orbit.classList.remove("cards-orbit--intro-pending");
  }

  function clearIntroStyles() {
    orbit.classList.remove("cards-orbit--intro");
    cards.forEach((card) => {
      card.style.removeProperty("--spiral-x");
      card.style.removeProperty("--spiral-y");
      card.style.removeProperty("--spiral-delay");
      card.style.animation = "none";
      card.style.filter = "";
    });
  }

  function startHomeChatIntro() {
    if (!main || prefersReducedMotion) return;

    main.classList.remove("main--home-intro-settled");
    main.classList.add("main--home-intro-animate");
    void main.offsetWidth;

    requestAnimationFrame(() => {
      main.classList.add("main--home-intro-settled");
    });
  }

  function endHomeChatIntro() {
    main?.classList.remove("main--home-intro-animate", "main--home-intro-settled");
  }

  function stopIntro() {
    if (introEndTimer) {
      window.clearTimeout(introEndTimer);
      introEndTimer = null;
    }
    clearIntroStyles();
    endHomeChatIntro();
    isPlaying = false;
    if (replayBtn) replayBtn.disabled = prefersReducedMotion;
  }

  function measureOffsets() {
    const cx = orbit.clientWidth / 2;
    const cy = orbit.clientHeight / 2;

    return cards.map((card) => {
      const cardCx = card.offsetLeft + card.offsetWidth / 2;
      const cardCy = card.offsetTop + card.offsetHeight / 2;
      const dx = cx - cardCx;
      const dy = cy - cardCy;
      const angle = Math.atan2(cardCy - cy, cardCx - cx);

      return { card, dx, dy, angle };
    });
  }

  function sortEntriesFromPersonal(entries) {
    const start = -Math.PI / 2;
    const wrap = Math.PI * 2;
    const sorted = [...entries].sort((a, b) => {
      const na = (a.angle - start + wrap) % wrap;
      const nb = (b.angle - start + wrap) % wrap;
      return na - nb;
    });

    const personalIndex = sorted.findIndex((entry) =>
      entry.card.classList.contains("category-card--personal")
    );
    if (personalIndex <= 0) return sorted;

    return [
      ...sorted.slice(personalIndex),
      ...sorted.slice(0, personalIndex),
    ];
  }

  function playIntro() {
    if (!cards.length || prefersReducedMotion) {
      finishPending();
      endHomeChatIntro();
      return;
    }

    stopIntro();
    isPlaying = true;
    if (replayBtn) replayBtn.disabled = true;

    const entries = sortEntriesFromPersonal(measureOffsets());

    entries.forEach(({ card, dx, dy }, index) => {
      card.style.animation = "";
      card.style.setProperty("--spiral-x", `${dx}px`);
      card.style.setProperty("--spiral-y", `${dy}px`);
      card.style.setProperty("--spiral-delay", `${index * INTRO_STAGGER_MS}ms`);
    });

    finishPending();
    void orbit.offsetWidth;
    orbit.classList.add("cards-orbit--intro");
    startHomeChatIntro();

    if (window.RippleBackground?.reveal) {
      window.RippleBackground.reveal();
    }

    const totalMs =
      INTRO_DURATION_MS + (entries.length - 1) * INTRO_STAGGER_MS + 80;

    introEndTimer = window.setTimeout(() => {
      stopIntro();
    }, totalMs);
  }

  function replayHomeIntro() {
    window.CategoryPanel?.deselect?.();
    window.Chat?.resetToHome?.();
    orbit.classList.add("cards-orbit--intro-pending");
    playIntro();
  }

  window.CardsIntro = { play: playIntro, replayHome: replayHomeIntro };

  if (replayBtn) {
    replayBtn.disabled = prefersReducedMotion;
    replayBtn.addEventListener("click", replayHomeIntro);
  }

  if (!cards.length || prefersReducedMotion) {
    finishPending();
    endHomeChatIntro();
    return;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", playIntro, { once: true });
  } else {
    requestAnimationFrame(playIntro);
  }
})();
