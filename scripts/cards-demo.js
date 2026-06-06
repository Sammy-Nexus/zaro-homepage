(function () {
  const toggle = document.getElementById("empty-states-demo");
  const cards = [...document.querySelectorAll(".category-card")];

  function isOperationsCard(card) {
    return card.classList.contains("category-card--operations");
  }

  function setOperationsAppCount(card) {
    const countEl = card.querySelector(".category-card__count");
    if (!countEl) return;

    countEl.dataset.defaultCount = "1";
    countEl.textContent = "1 App";
    card.classList.remove("category-card--empty");
    card.removeAttribute("aria-disabled");
  }

  if (!cards.length) return;

  function randomAppCount() {
    return 2 + Math.floor(Math.random() * 19);
  }

  function formatAppCount(count) {
    return count === 1 ? "1 App" : `${count} Apps`;
  }

  cards.forEach((card) => {
    if (isOperationsCard(card)) {
      setOperationsAppCount(card);
      return;
    }

    const countEl = card.querySelector(".category-card__count");
    if (!countEl) return;

    const count = randomAppCount();
    countEl.dataset.defaultCount = String(count);
    countEl.textContent = formatAppCount(count);
  });

  if (toggle) {
    function setCardEmpty(card, empty) {
      if (isOperationsCard(card)) {
        setOperationsAppCount(card);
        return;
      }

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
      const candidates = cards.filter((card) => !isOperationsCard(card));
      const shuffled = [...candidates].sort(() => Math.random() - 0.5);
      const emptyCount = 1 + Math.floor(Math.random() * Math.max(1, candidates.length - 1));

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
  }
})();
