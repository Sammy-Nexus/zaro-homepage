(function () {
  const SESSION_TITLE = "Build new app request";
  const main = document.getElementById("main");
  const sessionsList = document.getElementById("sessions-list");
  const sessionView = document.getElementById("session-view");
  const homeNav = document.querySelector('.nav-row[href="index.html"]');
  const chatBar = document.getElementById("chat-bar");

  if (!main || !sessionsList || !sessionView) return;

  let sessionCounter = 0;
  let activeSessionId = null;

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setActiveSessionRow(sessionId) {
    sessionsList.querySelectorAll(".session-row").forEach((row) => {
      row.classList.toggle("session-row--active", row.dataset.sessionId === sessionId);
    });
  }

  function setHomeNavActive(active) {
    homeNav?.classList.toggle("nav-row--active", active);
  }

  function resetSendState() {
    if (!chatBar) return;

    chatBar.classList.remove("chat-bar--sending");
    chatBar.querySelectorAll(".chat-bar__send").forEach((btn) => {
      btn.classList.remove("chat-bar__send--loading");
      btn.disabled = false;
    });
  }

  function openSessionView(sessionId, message) {
    window.CategoryPanel?.deselect?.();

    activeSessionId = sessionId;
    setActiveSessionRow(sessionId);
    setHomeNavActive(false);

    main.classList.remove(
      "main--session-chat-visible",
      "main--session-chat-enter-ready"
    );
    main.classList.add("main--session-view", "main--chat-active");
    sessionView.hidden = false;

    const textarea = document.querySelector(".chat-bar__textarea");
    const compactInput = document.querySelector(".chat-bar__input-compact");
    const expanded = document.querySelector(".chat-bar__expanded");
    const compactRow = document.querySelector(".chat-bar__compact");

    if (textarea instanceof HTMLTextAreaElement) {
      textarea.value = message || "";
    }
    if (compactInput instanceof HTMLInputElement) {
      compactInput.value = message ? message.split(/\r?\n/)[0] : "";
    }

    expanded?.setAttribute("aria-hidden", "false");
    compactRow?.setAttribute("aria-hidden", "true");
    chatBar?.classList.toggle("chat-bar--has-text", Boolean(message?.trim()));

    window.Chat?.syncExpandedLayout?.();

    document.title = `Scaling Europe — ${SESSION_TITLE}`;

    resetSendState();

    void chatBar?.offsetWidth;
    main.classList.add("main--session-chat-enter-ready");

    requestAnimationFrame(() => {
      main.classList.add("main--session-chat-visible");
      textarea?.focus();
      if (textarea instanceof HTMLTextAreaElement) {
        const end = textarea.value.length;
        textarea.setSelectionRange(end, end);
      }
    });
  }

  function goHome() {
    activeSessionId = null;
    setActiveSessionRow(null);
    setHomeNavActive(true);

    window.AltBuilder?.close?.();

    main.classList.remove(
      "main--session-view",
      "main--session-chat-visible",
      "main--session-chat-enter-ready",
      "main--chat-active",
      "main--builder-view"
    );
    sessionView.hidden = true;
    document.title = "Scaling Europe — Home";

    window.CardsIntro?.replayHome?.();
  }

  function handleHomeNavClick(event) {
    if (main.classList.contains("main--session-view") || main.classList.contains("main--builder-view")) {
      event.preventDefault();
      goHome();
      return;
    }

    if (homeNav?.classList.contains("nav-row--active")) {
      event.preventDefault();
      window.CardsIntro?.replayHome?.();
    }
  }

  function createSessionRow(sessionId, title, options = {}) {
    const row = document.createElement("div");
    row.className = options.animate
      ? "session-row session-row--enter"
      : "session-row";
    row.dataset.sessionId = sessionId;
    row.innerHTML = `
      <span class="session-row__label">${escapeHtml(title)}</span>
      <button class="session-row__menu" type="button" aria-label="Session options">
        <img src="assets/sidebar/icon-session-menu.svg" width="14" height="14" alt="" />
      </button>
    `;

    if (options.animate) {
      row.addEventListener(
        "animationend",
        () => {
          row.classList.remove("session-row--enter");
        },
        { once: true }
      );
    }

    return row;
  }

  function createAndOpen() {
    sessionCounter += 1;
    const sessionId = `session-new-${sessionCounter}-${Date.now()}`;
    const row = createSessionRow(sessionId, SESSION_TITLE, { animate: true });
    sessionsList.prepend(row);
    openSessionView(sessionId, "");
    return sessionId;
  }

  sessionsList.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(".session-row__menu")) return;

    const row = target.closest(".session-row");
    if (!(row instanceof HTMLElement) || !row.dataset.sessionId) return;

    openSessionView(row.dataset.sessionId, "");
  });

  homeNav?.addEventListener("click", handleHomeNavClick);

  window.Sessions = {
    createAndOpen,
    goHome,
    open: openSessionView,
  };
})();
