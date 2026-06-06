(function () {
  const APP_NAV_KEY = "zaro-page-nav";
  const APP_NAV_MS = 420;

  const APP_ROUTES = {
    apps: "apps.html",
    "scaling-studio": "scaling-studio.html",
  };

  function playEnterIfNeeded() {
    const app = document.querySelector(".app");
    if (!app) return;

    let target = null;
    try {
      target = sessionStorage.getItem(APP_NAV_KEY);
    } catch (_) {}

    if (!target) return;

    try {
      sessionStorage.removeItem(APP_NAV_KEY);
    } catch (_) {}

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    app.classList.add("app--page-enter");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => app.classList.add("app--page-enter-active"));
    });
  }

  function navigateWithTransition(url, sourceEl) {
    const app = document.querySelector(".app");
    if (!app || app.classList.contains("app--page-navigating")) return false;

    if (sourceEl instanceof HTMLElement) {
      sourceEl.classList.add("category-panel__app-row--activating");
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.location.href = url;
      return true;
    }

    app.classList.add("app--page-navigating");
    window.setTimeout(() => {
      window.location.href = url;
    }, APP_NAV_MS);
    return true;
  }

  function navigateToApps(sourceEl) {
    try {
      sessionStorage.setItem(APP_NAV_KEY, "apps");
    } catch (_) {}
    return navigateWithTransition(APP_ROUTES.apps, sourceEl);
  }

  function navigateToApp(slug, sourceEl) {
    const url = APP_ROUTES[slug] || APP_ROUTES.apps;
    try {
      sessionStorage.setItem(APP_NAV_KEY, slug);
    } catch (_) {}
    return navigateWithTransition(url, sourceEl);
  }

  window.PageNav = { navigateToApps, navigateToApp, playEnterIfNeeded };
  playEnterIfNeeded();
})();
