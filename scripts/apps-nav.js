(function () {
  const APP_ROUTES = {
    apps: "apps.html",
    "scaling-studio": "scaling-studio.html",
  };

  document.querySelectorAll("[data-app-slug]").forEach((el) => {
    el.addEventListener("click", (event) => {
      const slug = el.dataset.appSlug;
      if (!slug) return;
      event.preventDefault();
      window.PageNav?.navigateToApp?.(slug, el);
    });
  });
})();
