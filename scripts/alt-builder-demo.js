(function () {
  const STORAGE_KEY = "zaro-alt-builder-demo-v2";
  const LEGACY_STORAGE_KEY = "zaro-alt-builder-demo";
  const BUILDER_TITLE = "Build new app request";
  const HOLD_AFTER_INTRO_MS = 2500;
  const BUILDER_EXIT_MS = 520;
  const BUILDER_PATTERN_RETURN_MS = 600;
  const STATUS_PILL_STEP = "Creating agents...";
  const STATUS_PILL_ENABLED = false;

  const LOADER_INTERVAL_MS = 800;
  const LOADER_WAVE_MS = 700;

  const toggle = document.getElementById("alt-builder-demo");
  const main = document.getElementById("main");
  const builderView = document.getElementById("builder-view");
  const builderLoader = document.getElementById("builder-loader");
  const builderFeed = document.getElementById("builder-feed");
  const statusPill = document.getElementById("builder-status-pill");
  const statusPillLoader = document.getElementById("builder-status-pill-loader");
  const statusPillText = statusPill?.querySelector(".builder-status-pill__text");
  const sessionView = document.getElementById("session-view");
  const homeNav = document.querySelector('.nav-row[href="index.html"]');
  const chatBar = document.getElementById("chat-bar");

  if (!main || !builderView) return;

  let loaderInstance = null;
  let pillLoaderInstance = null;
  let feedController = null;
  let returnTimer = null;
  let completing = false;
  let scalingStudioRevealed = false;

  function isEnabled() {
    if (toggle instanceof HTMLInputElement) return toggle.checked;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return stored === "true";
    } catch (_) {}

    return true;
  }

  function persistEnabled(enabled) {
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch (_) {}
  }

  function resetSendState() {
    if (!chatBar) return;

    chatBar.classList.remove("chat-bar--sending");
    chatBar.querySelectorAll(".chat-bar__send").forEach((btn) => {
      btn.classList.remove("chat-bar__send--loading");
      btn.disabled = false;
    });
  }

  function setHomeNavActive(active) {
    homeNav?.classList.toggle("nav-row--active", active);
  }

  function clearReturnTimer() {
    if (returnTimer !== null) {
      window.clearTimeout(returnTimer);
      returnTimer = null;
    }
  }

  function revealScalingStudioApp() {
    scalingStudioRevealed = true;
  }

  function scheduleReturnHomeAfterIntro() {
    clearReturnTimer();
    returnTimer = window.setTimeout(() => {
      returnTimer = null;
      finishBuilderDemo();
    }, HOLD_AFTER_INTRO_MS);
  }

  function pulsePillShimmer() {
    if (!statusPillText) return;
    statusPillText.classList.remove("builder-status-pill__text--shimmer");
    void statusPillText.offsetWidth;
    statusPillText.classList.add("builder-status-pill__text--shimmer");
  }

  function stopPillLoader() {
    pillLoaderInstance?.destroy?.();
    pillLoaderInstance = null;
  }

  function hideStatusPill() {
    stopPillLoader();
    if (!statusPill) return;
    statusPill.classList.remove("builder-status-pill--enter-active");
    statusPill.setAttribute("hidden", "");
    statusPillText?.classList.remove("builder-status-pill__text--shimmer");
  }

  function showStatusPill() {
    if (!STATUS_PILL_ENABLED) return;
    if (!statusPill || !statusPillLoader || !statusPillText) return;

    stopPillLoader();

    const pillStep =
      window.BuilderFeed?.STEPS?.[1] ?? STATUS_PILL_STEP;
    statusPillText.textContent = pillStep;

    const pulseInterval =
      window.BuilderLoader?.PULSE_INTERVAL_MS ?? LOADER_INTERVAL_MS;

    statusPill.style.setProperty("--builder-pulse-duration", `${pulseInterval}ms`);
    statusPill.removeAttribute("hidden");
    statusPill.classList.remove("builder-status-pill--enter-active");
    void statusPill.offsetWidth;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      statusPill.classList.add("builder-status-pill--enter-active");
      pulsePillShimmer();
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        statusPill.classList.add("builder-status-pill--enter-active");
      });
    });

    pillLoaderInstance =
      window.BuilderLoader?.mountSmall?.(statusPillLoader, {
        color: "#BDB4F8",
        opacity: 1,
        interval: LOADER_INTERVAL_MS,
        waveDuration: LOADER_WAVE_MS,
        onPulse: pulsePillShimmer,
      }) ?? null;

    pulsePillShimmer();
  }

  function stopBuilderAnimations() {
    clearReturnTimer();
    feedController?.stop?.();
    loaderInstance?.destroy?.();
    loaderInstance = null;
    feedController = null;
  }

  function startBuilderAnimations() {
    stopBuilderAnimations();
    hideStatusPill();

    feedController =
      window.BuilderFeed?.createFeedController?.(builderFeed, {
        firstStepIntervalMs: 10000,
      }) ?? null;

    const pulseInterval =
      window.BuilderLoader?.PULSE_INTERVAL_MS ?? LOADER_INTERVAL_MS;

    builderView?.style.setProperty(
      "--builder-pulse-duration",
      `${pulseInterval}ms`
    );

    loaderInstance =
      window.BuilderLoader?.mount?.(builderLoader, {
        interval: LOADER_INTERVAL_MS,
        waveDuration: LOADER_WAVE_MS,
        onPulse: () => feedController?.pulseShimmer?.(),
        onIntroComplete: scheduleReturnHomeAfterIntro,
      }) ?? null;

    feedController?.start?.();
  }

  function openBuilderView() {
    completing = false;
    clearReturnTimer();
    hideStatusPill();

    window.CategoryPanel?.deselect?.();
    window.Chat?.prepareHomeFromSession?.();

    main.classList.remove(
      "main--session-view",
      "main--session-chat-visible",
      "main--session-chat-enter-ready",
      "main--chat-active",
      "main--builder-exiting",
      "main--builder-returning"
    );
    if (sessionView) sessionView.hidden = true;

    builderView.hidden = false;
    void builderView.offsetWidth;
    main.classList.add("main--builder-view");
    setHomeNavActive(false);
    document.title = `Scaling Europe — ${BUILDER_TITLE}`;

    resetSendState();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        startBuilderAnimations();
      });
    });
  }

  function closeBuilderView() {
    main.classList.remove("main--builder-view", "main--builder-exiting");
    builderView.hidden = true;
    stopBuilderAnimations();
    setHomeNavActive(true);
    document.title = "Scaling Europe — Home";
  }

  function finishBuilderDemo() {
    if (completing || !main.classList.contains("main--builder-view")) return;
    completing = true;
    clearReturnTimer();
    stopBuilderAnimations();

    main.classList.add("main--builder-exiting");

    window.setTimeout(() => {
      revealScalingStudioApp();
      closeBuilderView();
      window.Chat?.resetToHome?.();

      main.style.setProperty(
        "--builder-pattern-return-duration",
        `${BUILDER_PATTERN_RETURN_MS}ms`
      );
      main.classList.add("main--builder-returning");
      void main.offsetWidth;

      showStatusPill();
      window.CategoryPanel?.selectBySlug?.("operations", { immediateBgDim: true });

      window.setTimeout(() => {
        main.classList.remove("main--builder-returning");
        main.style.removeProperty("--builder-pattern-return-duration");
        completing = false;
      }, BUILDER_PATTERN_RETURN_MS + 40);
    }, BUILDER_EXIT_MS);
  }

  function syncFromToggle() {
    if (!(toggle instanceof HTMLInputElement)) return;
    persistEnabled(toggle.checked);
  }

  if (toggle instanceof HTMLInputElement) {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (_) {}

    const stored = (() => {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch (_) {
        return null;
      }
    })();

    toggle.checked = stored === null ? true : stored === "true";

    toggle.addEventListener("change", syncFromToggle);
    persistEnabled(toggle.checked);
  }

  window.AltBuilder = {
    isEnabled,
    open: openBuilderView,
    close: () => {
      closeBuilderView();
      hideStatusPill();
    },
    hasScalingStudioApp: () => scalingStudioRevealed,
  };
})();
