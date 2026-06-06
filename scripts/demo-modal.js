(function () {
  const modal = document.getElementById("demo-modal");
  const modalTrigger = document.getElementById("demo-modal-trigger");
  const modalBackdrop = modal?.querySelector(".demo-modal__backdrop");
  const modalPanel = document.getElementById("demo-menu");

  if (!modal || !modalTrigger) return;

  function hideInapplicableDemoItems() {
    const hideControl = (id) => {
      const el = document.getElementById(id);
      const field = el?.closest(".demo-toggle, .demo-menu__field, .demo-menu__btn");
      if (field instanceof HTMLElement) field.hidden = true;
    };

    if (!document.querySelector(".category-card")) {
      hideControl("empty-states-demo");
      hideControl("replay-intro-demo");
    }

    if (!document.getElementById("chat-bar")) {
      hideControl("auto-type-demo");
      hideControl("auto-type-text");
      hideControl("alt-builder-demo");
    }

    if (!document.querySelector(".agents-page")) {
      hideControl("alt-agent-table-demo");
    }
  }

  function isModalOpen() {
    return !modal.hidden;
  }

  function openModal() {
    modal.hidden = false;
    document.body.classList.add("demo-modal-open");
    modalTrigger.setAttribute("aria-expanded", "true");

    const firstFocusable = modalPanel?.querySelector("input, button, select, textarea");
    if (firstFocusable instanceof HTMLElement) {
      firstFocusable.focus();
    }
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("demo-modal-open");
    modalTrigger.setAttribute("aria-expanded", "false");
    modalTrigger.focus();
  }

  modalTrigger.addEventListener("click", () => {
    if (isModalOpen()) {
      closeModal();
      return;
    }
    openModal();
  });

  modalBackdrop?.addEventListener("click", closeModal);

  modalPanel?.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && isModalOpen()) {
        event.preventDefault();
        event.stopPropagation();
        closeModal();
      }
    },
    true
  );

  hideInapplicableDemoItems();

  window.DemoModal = { open: openModal, close: closeModal, isOpen: isModalOpen };
})();
