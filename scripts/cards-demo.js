(function () {
  const toggle = document.getElementById("empty-states-demo");
  const cards = [...document.querySelectorAll(".category-card")];

  if (!cards.length) return;

  function randomAppCount() {
    return 2 + Math.floor(Math.random() * 19);
  }

  function formatAppCount(count) {
    return count === 1 ? "1 App" : `${count} Apps`;
  }

  cards.forEach((card) => {
    const countEl = card.querySelector(".category-card__count");
    if (!countEl) return;

    const count = randomAppCount();
    countEl.dataset.defaultCount = String(count);
    countEl.textContent = formatAppCount(count);
  });

  if (!toggle) return;

  function setCardEmpty(card, empty) {
    const countEl = card.querySelector(".category-card__count");
    const defaultCount = countEl?.dataset.defaultCount || "9";

    card.classList.toggle("category-card--empty", empty);
    card.removeAttribute("aria-disabled");

    if (countEl) {
      countEl.textContent = empty
        ? "0 Apps"
        : formatAppCount(Number(defaultCount));
    }
  }

  function randomizeEmptyStates() {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    const emptyCount = 1 + Math.floor(Math.random() * (cards.length - 1));

    cards.forEach((card) => setCardEmpty(card, false));
    shuffled.slice(0, emptyCount).forEach((card) => setCardEmpty(card, true));
  }

  function clearEmptyStates() {
    cards.forEach((card) => setCardEmpty(card, false));
  }

  toggle.addEventListener("change", () => {
    if (toggle.checked) {
      randomizeEmptyStates();
      return;
    }
    clearEmptyStates();
  });
})();
