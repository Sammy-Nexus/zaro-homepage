(function () {
  const STEPS = [
    "Building app...",
    "Creating agents...",
    "Scheduling agents...",
    "Configuring workflows...",
    "Preparing dashboard...",
  ];
  const STEP_INTERVAL_MS = 3500;

  function createFeedController(feedEl, options = {}) {
    if (!feedEl) return null;

    const steps = options.steps ?? STEPS;
    const stepIntervalMs = options.stepIntervalMs ?? STEP_INTERVAL_MS;
    const firstStepIntervalMs = options.firstStepIntervalMs ?? stepIntervalMs;
    let stepIndex = 0;
    let advanceTimer = null;
    let advancing = false;

    feedEl.innerHTML = `
      <div class="builder-feed">
        <div class="builder-feed__viewport">
          <div class="builder-feed__track"></div>
        </div>
      </div>
    `;

    const track = feedEl.querySelector(".builder-feed__track");
    if (!track) return null;

    function stepAt(offset) {
      return steps[(stepIndex + offset + steps.length) % steps.length];
    }

    function renderLines(count) {
      const lines = [];
      for (let i = 0; i < count; i++) {
        const isActive = i === 0;
        lines.push(
          `<p class="builder-feed__line${isActive ? " builder-feed__line--active" : ""}">${stepAt(i)}</p>`
        );
      }
      track.innerHTML = lines.join("");
    }

    function snapToResting() {
      track.style.transition = "none";
      track.classList.remove("builder-feed__track--scroll");
      renderLines(3);
      track.style.transform = "translate3d(0, 0, 0)";
      void track.offsetHeight;
      track.style.transition = "";
      track.style.transform = "";
    }

    function pulseShimmer() {
      const active = track.querySelector(".builder-feed__line--active");
      if (!active || track.classList.contains("builder-feed__track--scroll")) return;
      active.classList.remove("builder-feed__line--shimmer");
      void active.offsetWidth;
      active.classList.add("builder-feed__line--shimmer");
    }

    function renderResting() {
      snapToResting();
    }

    function waitForTransition() {
      return new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          track.removeEventListener("transitionend", onEnd);
          window.clearTimeout(fallback);
          resolve();
        };

        const onEnd = (event) => {
          if (event.target !== track || event.propertyName !== "transform") return;
          finish();
        };

        const fallback = window.setTimeout(finish, 800);
        track.addEventListener("transitionend", onEnd);
      });
    }

    async function advance() {
      if (advancing) return;
      advancing = true;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        stepIndex = (stepIndex + 1) % steps.length;
        renderResting();
        advancing = false;
        return;
      }

      snapToResting();
      renderLines(4);
      void track.offsetHeight;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          track.classList.add("builder-feed__track--scroll");
        });
      });

      await waitForTransition();

      stepIndex = (stepIndex + 1) % steps.length;
      snapToResting();
      pulseShimmer();
      advancing = false;
    }

    function clearAdvanceTimer() {
      if (advanceTimer !== null) {
        window.clearTimeout(advanceTimer);
        advanceTimer = null;
      }
    }

    function scheduleNextAdvance() {
      clearAdvanceTimer();
      const delay = stepIndex === 0 ? firstStepIntervalMs : stepIntervalMs;
      advanceTimer = window.setTimeout(() => {
        advanceTimer = null;
        advance().then(() => scheduleNextAdvance());
      }, delay);
    }

    function start() {
      renderResting();
      pulseShimmer();
      scheduleNextAdvance();
    }

    function stop() {
      clearAdvanceTimer();
      advancing = false;
      renderResting();
    }

    return { start, stop, pulseShimmer };
  }

  window.BuilderFeed = { createFeedController, STEPS };
})();
