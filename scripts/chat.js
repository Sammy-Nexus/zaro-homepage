(function () {
  const main = document.querySelector(".main");
  const chatBar = document.getElementById("chat-bar");
  const compactRow = document.querySelector(".chat-bar__compact");
  const compactInput = document.querySelector(".chat-bar__input-compact");
  const expanded = document.querySelector(".chat-bar__expanded");
  const compose = document.querySelector(".chat-bar__compose");
  const textarea = document.querySelector(".chat-bar__textarea");
  const root = document.documentElement;

  if (!main || !chatBar || !compactInput || !textarea || !expanded || !compose) return;

  const LINE_HEIGHT = 19.2;
  const MAX_LINES = 8;
  const COMPOSE_PADDING = 24;
  const FOOTER_HEIGHT = 48;
  const DEFAULT_COMPOSE_HEIGHT = 72;
  const DEFAULT_CHAT_HEIGHT = DEFAULT_COMPOSE_HEIGHT + FOOTER_HEIGHT;
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
    const extra = Math.max(0, chatHeight - DEFAULT_CHAT_HEIGHT);

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

  function activateChat(initialChar) {
    if (isActive()) return;

    syncTextareaFromCompact(initialChar);
    main.classList.add("main--chat-active");
    setChatPanels(true);
    updateChatSize();

    requestAnimationFrame(() => {
      textarea.focus();
      const end = textarea.value.length;
      textarea.setSelectionRange(end, end);
    });
  }

  function truncateToOneLine(value) {
    if (!value) return "";
    return value.split(/\r?\n/)[0];
  }

  function deactivateChat() {
    if (!isActive()) return;

    const oneLine = truncateToOneLine(textarea.value);
    textarea.value = oneLine;
    compactInput.value = oneLine;

    root.style.setProperty("--chat-compose-height", `${DEFAULT_COMPOSE_HEIGHT}px`);
    root.style.setProperty("--chat-expanded-height", `${DEFAULT_CHAT_HEIGHT}px`);
    root.style.setProperty("--chat-extra", "0px");

    main.classList.remove("main--chat-active");
    setChatPanels(false);
    resetChatSize();
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

      if (isCategorySelected() || isActive()) return;

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
    if (isCategorySelected() || isActive()) return;
    if (event.target.closest("button")) return;
    event.preventDefault();
    activateChat();
  });

  compactInput.addEventListener("keydown", (event) => {
    if (isCategorySelected() || isActive()) return;
    if (event.key.length === 1 || event.key === "Backspace") {
      event.preventDefault();
      activateChat(event.key.length === 1 ? event.key : undefined);
    }
  });

  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      deactivateChat();
    }
  });

  textarea.addEventListener("input", updateChatSize);

  chatBar.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  document.addEventListener("mousedown", (event) => {
    if (!isActive()) return;
    if (chatBar.contains(event.target)) return;
    deactivateChat();
  });

  window.addEventListener("resize", () => {
    if (isActive()) updateChatSize();
  });
})();
