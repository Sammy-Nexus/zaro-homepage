(function () {
  const SESSION_TITLE = "Build new app request";
  const main = document.getElementById("main");
  const sessionsList = document.getElementById("sessions-list");
  const sessionView = document.getElementById("session-view");
  const newTaskNav = document.querySelector(".nav-row--new-task");
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

  function clearActiveTaskRow() {
    setActiveSessionRow(null);
  }

  function prepareForNewTask() {
    activeSessionId = null;
    clearActiveTaskRow();
    newTaskNav?.classList.remove("nav-row--active");
    document.title = "Scaling Europe — Home";
  }

  function exitToOrbit(options = {}) {
    const replayIntro = options.replayIntro !== false;

    activeSessionId = null;
    clearActiveTaskRow();
    newTaskNav?.classList.remove("nav-row--active");

    window.AltBuilder?.close?.();

    main.classList.remove(
      "main--session-view",
      "main--session-chat-visible",
      "main--session-chat-enter-ready",
      "main--chat-active",
      "main--chat-draft",
      "main--builder-view"
    );
    sessionView.hidden = true;
    document.title = "Scaling Europe — Home";

    window.CategoryPanel?.deselect?.();
    window.Chat?.resetToHome?.();

    if (replayIntro) {
      window.CardsIntro?.replayHome?.();
    }
  }

  function goHome() {
    exitToOrbit({ replayIntro: true });
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
    newTaskNav?.classList.remove("nav-row--active");

    main.classList.remove(
      "main--session-chat-visible",
      "main--session-chat-enter-ready",
      "main--chat-draft"
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

  function handleNewTaskNavClick(event) {
    if (main.classList.contains("main--session-view") || main.classList.contains("main--builder-view")) {
      event.preventDefault();
      window.Chat?.openNewTask?.();
      return;
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
    const message = window.Chat?.getChatMessage?.() || "";
    sessionCounter += 1;
    const sessionId = `session-new-${sessionCounter}-${Date.now()}`;
    const row = createSessionRow(sessionId, SESSION_TITLE, { animate: true });
    sessionsList.prepend(row);
    openSessionView(sessionId, message);
    return sessionId;
  }

  sessionsList.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(".session-row__menu")) return;

    const row = target.closest(".session-row");
    if (!(row instanceof HTMLElement) || !row.dataset.sessionId) return;

    openSessionView(row.dataset.sessionId, "");
  });

  newTaskNav?.addEventListener("click", handleNewTaskNavClick);

  window.Sessions = {
    createAndOpen,
    goHome,
    exitToOrbit,
    prepareForNewTask,
    open: openSessionView,
  };
})();
