(function () {
  const STORIES = [
    {
      id: "1",
      source: "BleepingComputer",
      initial: "B",
      age: "18d ago",
      title:
        "OpenAI Confirms Security Breach in TanStack Supply Chain Attack, Rotates Code-Signing Certificates",
      excerpt:
        "OpenAI confirmed two employees' devices were breached in the massive 'Mini Shai-Hulud' supply chain campaign that compromised hundreds of npm and PyPI packages via TanStack and Mistral AI. The company is rotating code-signing certificates for macOS, Windows, iOS, and Android apps, and says no customer data, production systems, or deployed software was impacted.",
      tags: ["Global", "AI", "Policy"],
      topic: "ai",
      region: "global",
      channel: "news",
    },
    {
      id: "2",
      source: "The Verge",
      initial: "T",
      age: "18d ago",
      title:
        "Linux Devs Are Fighting the New Age-Gated Internet as Colorado Bill Targets Operating Systems",
      excerpt:
        "Linux laptop maker System76 and open-source developers are pushing back against proposed age-verification laws like Colorado's SB26-051 that would require operating systems to collect and pass users' ages to app developers. The bill was designed for commercial platforms like iOS and Android but would create cascading compliance issues for open-source OSes.",
      tags: ["US", "Policy"],
      topic: "policy",
      region: "us",
      channel: "news",
    },
    {
      id: "3",
      source: "The Verge",
      initial: "T",
      age: "18d ago",
      title:
        "Microsoft Starts Canceling Claude Code Licenses, Pushes Developers to Copilot CLI",
      excerpt:
        "Microsoft has begun revoking access to Anthropic's Claude Code for internal developers, redirecting teams toward GitHub Copilot CLI instead. The move signals tighter alignment between Microsoft's AI stack and its own tooling as enterprise customers weigh multi-model workflows.",
      tags: ["US", "AI"],
      topic: "ai",
      region: "us",
      channel: "news",
    },
    {
      id: "4",
      source: "Tech.eu",
      initial: "T",
      age: "18d ago",
      title:
        "Twin Prime Lands €4M Pre-Seed to Build Frontier AI Models for Defence and Security",
      excerpt:
        "London-based Twin Prime has raised €4M in pre-seed funding to develop frontier AI models tailored for defence and security applications. The round was led by European VCs betting on sovereign AI capabilities amid growing demand for trusted models in regulated sectors.",
      tags: ["Europe", "AI"],
      topic: "ai",
      region: "europe",
      channel: "news",
    },
    {
      id: "5",
      source: "Sifted",
      initial: "S",
      age: "19d ago",
      title: "European Fintech Funding Rebounds in Q1 With Payments Leading",
      excerpt:
        "European fintech startups raised €2.1B in Q1, led by payments infrastructure and embedded finance plays. Investors cite improving unit economics and clearer paths to profitability compared with 2023's trough.",
      tags: ["Europe", "Fintech"],
      topic: "fintech",
      region: "europe",
      channel: "news",
    },
    {
      id: "6",
      source: "@a16z",
      initial: "X",
      age: "18d ago",
      title: "The best GTM teams are treating AI agents as first-class teammates",
      excerpt:
        "Thread on how top SaaS companies are wiring agent workflows into pipeline reviews, outbound, and customer success — not as experiments, but as standing parts of the revenue org.",
      tags: ["US", "VC"],
      topic: "vc",
      region: "us",
      channel: "x",
    },
  ];

  const state = {
    topic: "all",
    channel: "all",
    view: "feed",
    expandedId: null,
  };

  const feedEl = document.getElementById("ss-feed");
  const emptyEl = document.getElementById("ss-empty");
  const views = [...document.querySelectorAll(".ss-view")];

  function matchesFilters(story) {
    const topicOk =
      state.topic === "all" ||
      story.topic === state.topic ||
      story.region === state.topic ||
      story.tags.some((t) => t.toLowerCase() === state.topic);
    const channelOk = state.channel === "all" || story.channel === state.channel;
    return topicOk && channelOk;
  }

  function renderFeed() {
    if (!feedEl) return;

    const items = STORIES.filter(matchesFilters);
    feedEl.innerHTML = items
      .map((story) => {
        const expanded = state.expandedId === story.id;
        return `
          <button type="button" class="ss-card${expanded ? " ss-card--expanded" : ""}" data-story-id="${story.id}">
            <span class="ss-card__avatar">${story.initial}</span>
            <span class="ss-card__body">
              <span class="ss-card__meta">
                <span>${story.source}</span>
                <span>·</span>
                <span>${story.age}</span>
              </span>
              <span class="ss-card__headline">${story.title}</span>
              <span class="ss-card__excerpt${expanded ? "" : " is-collapsed"}">${story.excerpt}</span>
              <span class="ss-card__tags">
                ${story.tags.map((tag) => `<span class="ss-tag">${tag}</span>`).join("")}
              </span>
            </span>
            <svg class="ss-card__chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        `;
      })
      .join("");

    if (emptyEl) emptyEl.hidden = items.length > 0;
    feedEl.hidden = items.length === 0;
  }

  function setActiveFilter(group, value, btn) {
    if (group === "topic") state.topic = value;
    if (group === "channel") state.channel = value;

    document.querySelectorAll(`.ss-filter[data-group="${group}"]`).forEach((el) => {
      el.classList.toggle("ss-filter--active", el === btn);
    });

    state.expandedId = null;
    renderFeed();
  }

  function setView(view) {
    state.view = view;
    views.forEach((el) => {
      el.classList.toggle("ss-view--active", el.dataset.view === view);
    });

    document.querySelectorAll(".ss-sidebar__btn[data-view]").forEach((btn) => {
      btn.classList.toggle("ss-sidebar__btn--active", btn.dataset.view === view);
    });
  }

  document.querySelectorAll(".ss-filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveFilter(btn.dataset.group, btn.dataset.value, btn);
    });
  });

  document.querySelectorAll(".ss-sidebar__btn[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  feedEl?.addEventListener("click", (event) => {
    const card = event.target.closest(".ss-card");
    if (!card) return;
    const id = card.dataset.storyId;
    state.expandedId = state.expandedId === id ? null : id;
    renderFeed();
  });

  renderFeed();
})();
