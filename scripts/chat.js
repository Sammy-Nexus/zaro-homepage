(function () {
  const main = document.querySelector(".main");
  const chatBar = document.getElementById("chat-bar");
  const compactRow = document.querySelector(".chat-bar__compact");
  const compactInput = document.querySelector(".chat-bar__input-compact");
  const expanded = document.querySelector(".chat-bar__expanded");
  const compose = document.querySelector(".chat-bar__compose");
  const textarea = document.querySelector(".chat-bar__textarea");
  const root = document.documentElement;
  const autoTypeToggle = document.getElementById("auto-type-demo");
  const autoTypeText = document.getElementById("auto-type-text");

  if (!main || !chatBar || !compactInput || !textarea || !expanded || !compose) return;

  const AUTO_TYPE_DELAY_MS = 1000;
  const AUTO_TYPE_CHAR_MS = 28;
  const TRICKY_CHARS = new Set([
    " ",
    ".",
    ",",
    "!",
    "?",
    ":",
    ";",
    "-",
    "/",
    "\\",
    "(",
    ")",
    "[",
    "]",
    "{",
    "}",
    '"',
    "'",
    "@",
    "#",
    "$",
    "%",
    "&",
    "*",
    "+",
    "=",
    "<",
    ">",
    "|",
    "`",
    "~",
    "\n",
    "\t",
  ]);
  let autoTypeDelayTimer = null;
  let autoTypeTypingTimer = null;

  function cancelAutoType() {
    if (autoTypeDelayTimer !== null) {
      window.clearTimeout(autoTypeDelayTimer);
      autoTypeDelayTimer = null;
    }
    if (autoTypeTypingTimer !== null) {
      window.clearTimeout(autoTypeTypingTimer);
      autoTypeTypingTimer = null;
    }
  }

  function autoTypeDelayForChar(char, prevChar) {
    let delay = AUTO_TYPE_CHAR_MS + Math.round((Math.random() - 0.5) * 12);

    if (TRICKY_CHARS.has(char)) {
      delay += 28 + Math.random() * 48;
    }

    if (prevChar && TRICKY_CHARS.has(prevChar)) {
      delay += 12 + Math.random() * 28;
    }

    if (char === "\n") {
      delay += 55 + Math.random() * 75;
    }

    return Math.max(16, Math.round(delay));
  }

  function typeAutoTypeCharacter(script, index) {
    if (!isActive() || !isAutoTypeEnabled() || index >= script.length) {
      cancelAutoType();
      updateChatSize();
      updateSendState();
      return;
    }

    const prevChar = index > 0 ? script[index - 1] : "";
    const char = script[index];

    textarea.value += char;
    updateChatSize();
    updateSendState();

    const nextIndex = index + 1;
    autoTypeTypingTimer = window.setTimeout(() => {
      autoTypeTypingTimer = null;
      typeAutoTypeCharacter(script, nextIndex);
    }, autoTypeDelayForChar(char, prevChar));
  }

  function isAutoTypeEnabled() {
    return Boolean(autoTypeToggle?.checked && autoTypeText?.value);
  }

  function isChatBlank() {
    return textarea.value.trim() === "" && compactInput.value.trim() === "";
  }

  function scheduleAutoType(fromClick) {
    cancelAutoType();
    if (!fromClick || !isAutoTypeEnabled() || !isChatBlank()) return;

    const script = autoTypeText.value;

    autoTypeDelayTimer = window.setTimeout(() => {
      autoTypeDelayTimer = null;
      if (!isActive() || !isAutoTypeEnabled() || !isChatBlank()) return;

      let index = 0;
      typeAutoTypeCharacter(script, index);
    }, AUTO_TYPE_DELAY_MS);
  }

  function hasChatText() {
    const value = isActive() ? textarea.value : compactInput.value;
    return value.trim().length > 0;
  }

  function updateSendState() {
    chatBar.classList.toggle("chat-bar--has-text", hasChatText());
  }

  const LINE_HEIGHT = 19.2;
  const MAX_LINES = 8;
  const LOCK_LINES = 3;
  const COMPOSE_PADDING = 24;
  const FOOTER_HEIGHT = 48;
  const DEFAULT_COMPOSE_HEIGHT = 72;
  const DEFAULT_CHAT_HEIGHT = DEFAULT_COMPOSE_HEIGHT + FOOTER_HEIGHT;
  const LOCK_COMPOSE_HEIGHT = COMPOSE_PADDING + LINE_HEIGHT * LOCK_LINES;
  const LOCK_CHAT_HEIGHT = LOCK_COMPOSE_HEIGHT + FOOTER_HEIGHT;
  const MAX_TEXT_HEIGHT = LINE_HEIGHT * MAX_LINES;
  const MAX_COMPOSE_HEIGHT = COMPOSE_PADDING + MAX_TEXT_HEIGHT;

  const IGNORE_KEYS = new Set([
    "Tab",
    "Escape",
    "Shift",
    "Control",
    "Alt",
    "Meta",
    "CapsLock",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End",
    "PageUp",
    "PageDown",
    "Enter",
    "F1",
    "F2",
    "F3",
    "F4",
    "F5",
    "F6",
    "F7",
    "F8",
    "F9",
    "F10",
    "F11",
    "F12",
  ]);

  function isActive() {
    return main.classList.contains("main--chat-active");
  }

  function setChatPanels(active) {
    expanded.setAttribute("aria-hidden", active ? "false" : "true");
    if (compactRow) compactRow.setAttribute("aria-hidden", active ? "true" : "false");
  }

  function resetChatSize() {
    root.style.removeProperty("--chat-compose-height");
    root.style.removeProperty("--chat-expanded-height");
    root.style.setProperty("--chat-extra", "0px");
    textarea.style.height = "";
    textarea.style.overflowY = "";
  }

  function updateChatSize() {
    if (!isActive()) return;

    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    const textHeight = Math.max(48, Math.min(scrollHeight, MAX_TEXT_HEIGHT));
    const atMaxLines = scrollHeight > MAX_TEXT_HEIGHT;

    textarea.style.height = `${textHeight}px`;
    textarea.style.overflowY = atMaxLines ? "auto" : "hidden";

    const composeHeight = Math.min(
      Math.max(DEFAULT_COMPOSE_HEIGHT, COMPOSE_PADDING + textHeight),
      MAX_COMPOSE_HEIGHT
    );
    const chatHeight = composeHeight + FOOTER_HEIGHT;
    const cappedHeight = Math.min(chatHeight, LOCK_CHAT_HEIGHT);
    const extra = Math.max(0, cappedHeight - DEFAULT_CHAT_HEIGHT);

    root.style.setProperty("--chat-compose-height", `${composeHeight}px`);
    root.style.setProperty("--chat-expanded-height", `${chatHeight}px`);
    root.style.setProperty("--chat-extra", `${extra}px`);
  }

  function syncTextareaFromCompact(initialChar) {
    const compactText = compactInput.value;
    if (initialChar) {
      textarea.value = compactText + initialChar;
      return;
    }
    if (!textarea.value && compactText) {
      textarea.value = compactText;
    }
  }

  function focusTextarea() {
    const applyFocus = () => {
      textarea.focus({ preventScroll: true });
      const end = textarea.value.length;
      textarea.setSelectionRange(end, end);
    };

    // Defer past link/button focus so New Task nav clicks land in the input.
    window.setTimeout(applyFocus, 0);
  }

  function activateChat(initialChar, options = {}) {
    if (isActive()) {
      focusTextarea();
      return;
    }

    const fromClick = Boolean(options.fromClick);
    syncTextareaFromCompact(initialChar);
    main.classList.add("main--chat-active");
    setChatPanels(true);
    updateChatSize();
    updateSendState();
    scheduleAutoType(fromClick && !initialChar && isChatBlank());
    focusTextarea();
  }

  function truncateToOneLine(value) {
    if (!value) return "";
    return value.split(/\r?\n/)[0];
  }

  function isSessionView() {
    return main.classList.contains("main--session-view");
  }

  function isBuilderView() {
    return main.classList.contains("main--builder-view");
  }

  function deactivateChat() {
    if (!isActive() || isSessionView() || isBuilderView()) return;

    cancelAutoType();

    const oneLine = truncateToOneLine(textarea.value);
    textarea.value = oneLine;
    compactInput.value = oneLine;

    root.style.setProperty("--chat-compose-height", `${DEFAULT_COMPOSE_HEIGHT}px`);
    root.style.setProperty("--chat-expanded-height", `${DEFAULT_CHAT_HEIGHT}px`);
    root.style.setProperty("--chat-extra", "0px");

    main.classList.remove("main--chat-active", "main--chat-draft");
    setChatPanels(false);
    resetChatSize();
    updateSendState();
    compactInput.blur();
    textarea.blur();
  }

  function shouldIgnoreGlobalKey(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return true;
    if (IGNORE_KEYS.has(event.key)) return true;
    if (event.key.length !== 1 && event.key !== "Backspace") return true;
    return false;
  }

  function isEditableTarget(target) {
    if (!(target instanceof Element)) return false;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      return true;
    }
    return target.isContentEditable;
  }

  function isCategorySelected() {
    return main.classList.contains("main--category-selected");
  }

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        if (isActive()) {
          event.preventDefault();
          deactivateChat();
        }
        return;
      }

      if (isCategorySelected() || isActive() || isSessionView() || isBuilderView()) return;

      if (shouldIgnoreGlobalKey(event)) return;
      if (isEditableTarget(event.target)) return;

      if (event.key.length === 1) {
        event.preventDefault();
        activateChat(event.key);
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        activateChat();
      }
    },
    true
  );

  chatBar.addEventListener("mousedown", (event) => {
    if (isCategorySelected() || isActive() || isSessionView() || isBuilderView()) return;
    if (event.target.closest("button")) return;
    event.preventDefault();
    activateChat(undefined, { fromClick: true });
  });

  compactInput.addEventListener("keydown", (event) => {
    if (isCategorySelected() || isActive()) return;
    if (event.key.length === 1 || event.key === "Backspace") {
      event.preventDefault();
      activateChat(event.key.length === 1 ? event.key : undefined);
    }
  });

  textarea.addEventListener("keydown", (event) => {
    if (autoTypeTypingTimer !== null && !event.metaKey && !event.ctrlKey && !event.altKey) {
      cancelAutoType();
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (hasChatText()) chatBar.requestSubmit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      deactivateChat();
    }
  });

  textarea.addEventListener("input", () => {
    updateChatSize();
    updateSendState();
  });

  compactInput.addEventListener("input", updateSendState);

  const SEND_TRANSITION_MS = 250;

  function resetSendState() {
    chatBar.classList.remove("chat-bar--sending");
    chatBar.querySelectorAll(".chat-bar__send").forEach((btn) => {
      btn.classList.remove("chat-bar__send--loading");
      btn.disabled = false;
    });
  }

  function prepareHomeFromSession() {
    cancelAutoType();

    textarea.value = "";
    compactInput.value = "";
    resetChatSize();
    setChatPanels(false);
    updateSendState();
    resetSendState();
    compactInput.blur();
    textarea.blur();
  }

  function openNewTask() {
    cancelAutoType();
    window.CategoryPanel?.deselect?.();
    window.AltBuilder?.close?.();

    if (isSessionView() || isBuilderView()) {
      window.Sessions?.exitToOrbit?.({ replayIntro: false });
    }

    main.classList.remove("main--home-intro-animate", "main--home-intro-settled");
    document.documentElement.removeAttribute("data-new-task-pending");

    prepareHomeFromSession();
    main.classList.add("main--chat-draft");
    activateChat(undefined, { fromClick: true });
    window.Sessions?.prepareForNewTask?.();
  }

  function resetToHome() {
    prepareHomeFromSession();
    main.classList.remove("main--chat-active", "main--chat-draft");
  }

  function getChatMessage() {
    const value = isActive() ? textarea.value : compactInput.value;
    return value.trim();
  }

  function handleSend(event) {
    event.preventDefault();
    if (!hasChatText()) return;

    const sendBtn =
      event.submitter instanceof HTMLButtonElement
        ? event.submitter
        : chatBar.querySelector(".chat-bar__send--expanded, .chat-bar__compact .chat-bar__send");

    chatBar.classList.add("chat-bar--sending");
    if (sendBtn instanceof HTMLButtonElement) {
      sendBtn.classList.add("chat-bar__send--loading");
      sendBtn.disabled = true;
    }

    main.classList.remove("main--chat-draft");

    window.setTimeout(() => {
      if (window.AltBuilder?.isEnabled?.()) {
        window.AltBuilder.open(getChatMessage());
        return;
      }
      if (window.Sessions?.createAndOpen) {
        window.Sessions.createAndOpen();
        return;
      }
      resetSendState();
    }, SEND_TRANSITION_MS);
  }

  chatBar.addEventListener("submit", handleSend);

  document.addEventListener("mousedown", (event) => {
    if (!isActive() || isSessionView() || isBuilderView()) return;
    if (chatBar.contains(event.target)) return;
    deactivateChat();
  });

  window.addEventListener("resize", () => {
    if (isActive()) updateChatSize();
  });

  window.Chat = {
    syncExpandedLayout: updateChatSize,
    prepareHomeFromSession,
    resetToHome,
    openNewTask,
    activateChat,
    getChatMessage,
  };
})();
