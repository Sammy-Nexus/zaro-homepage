(function () {
  const NEW_TASK_PARAM = "new-task";

  function isHomePage() {
    const path = window.location.pathname;
    return path.endsWith("/") || path.endsWith("/index.html");
  }

  function shouldOpenFromUrl() {
    return (
      isHomePage() &&
      new URL(window.location.href).searchParams.get(NEW_TASK_PARAM) === "1"
    );
  }

  function markNewTaskUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set(NEW_TASK_PARAM, "1");
    window.history.replaceState(null, "", url);
  }

  function bootstrapFromUrl() {
    if (!shouldOpenFromUrl()) return;

    // Paint the rest homepage once, then run the normal chat expand.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.Chat?.openNewTask?.();
      });
    });
  }

  function bindNewTaskNav() {
    const link = document.querySelector(".nav-row--new-task");
    if (!link) return;

    link.addEventListener("mousedown", (event) => {
      if (!isHomePage()) return;
      event.preventDefault();
    });

    link.addEventListener("click", (event) => {
      if (!isHomePage()) return;

      event.preventDefault();
      markNewTaskUrl();
      window.Chat?.openNewTask?.();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bindNewTaskNav();
      bootstrapFromUrl();
    });
  } else {
    bindNewTaskNav();
    bootstrapFromUrl();
  }
})();
