(function () {
  const STORAGE_KEY = "zaro-scaling-europe-demo";
  const toggle = document.getElementById("scaling-europe-demo");
  const appsSection = document.getElementById("sidebar-apps-section");

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

  function applySidebarAppsSection(enabled) {
    if (!appsSection) return;
    appsSection.hidden = !enabled;
  }

  function syncFromToggle() {
    const enabled = isEnabled();
    persistEnabled(enabled);
    applySidebarAppsSection(enabled);
    window.CategoryPanel?.refreshApps?.();
  }

  if (toggle instanceof HTMLInputElement) {
    const stored = (() => {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch (_) {
        return null;
      }
    })();

    if (stored !== null) {
      toggle.checked = stored === "true";
    }

    toggle.addEventListener("change", syncFromToggle);
  }

  applySidebarAppsSection(isEnabled());
  persistEnabled(isEnabled());

  window.ScalingDemo = { isEnabled };
})();
