(function () {
  const page = document.querySelector(".scaling-studio-page");
  if (!page) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    page.classList.remove("scaling-studio-page--intro");
    return;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      page.classList.add("scaling-studio-page--intro-active");
      page.classList.remove("scaling-studio-page--intro");
    });
  });
})();
