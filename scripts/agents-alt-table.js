(function () {
  const STORAGE_KEY = "zaro-agents-alt-table";
  const page = document.querySelector(".agents-page");
  const toggle = document.getElementById("alt-agent-table-demo");

  if (!page || !(toggle instanceof HTMLInputElement)) return;

  function apply(enabled) {
    page.classList.toggle("agents-page--alt-table", enabled);
  }

  function syncFromToggle() {
    apply(toggle.checked);
    try {
      localStorage.setItem(STORAGE_KEY, String(toggle.checked));
    } catch (_) {}
  }

  window.AgentsPanel?.bindRowClicks?.();

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") toggle.checked = true;
    if (stored === "false") toggle.checked = false;
  } catch (_) {}

  apply(toggle.checked);
  toggle.addEventListener("change", syncFromToggle);

  window.AgentsAltTable = {
    isEnabled() {
      return toggle.checked;
    },
  };
})();
