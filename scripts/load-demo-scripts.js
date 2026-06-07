(function () {
  const DEMO_SCRIPTS = [
    "scripts/scaling-demo.js?v=1",
    "scripts/demo-modal.js?v=3",
    "scripts/cards-demo.js?v=5",
  ];

  function loadNext(index) {
    if (index >= DEMO_SCRIPTS.length) return;

    const script = document.createElement("script");
    script.src = DEMO_SCRIPTS[index];
    script.onload = () => loadNext(index + 1);
    document.head.appendChild(script);
  }

  const schedule =
    typeof requestIdleCallback === "function"
      ? (callback) => requestIdleCallback(callback, { timeout: 2000 })
      : (callback) => window.addEventListener("load", callback, { once: true });

  schedule(() => loadNext(0));
})();
