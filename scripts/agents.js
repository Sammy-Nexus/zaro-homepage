(function () {
  const page = document.querySelector(".agents-page");
  if (!page) return;

  const searchInput = document.getElementById("agents-search");
  const statusTabs = page.querySelectorAll(".agents-status-tab");
  const memberDropdown = document.getElementById("agents-member-dropdown");
  const columnsDropdown = document.getElementById("agents-columns-dropdown");
  const viewToggleBtns = page.querySelectorAll(".agents-view-toggle__btn");
  const refreshBtn = document.getElementById("agents-refresh-btn");
  const newAgentBtn = document.getElementById("agents-new-btn");
  const jobsCount = document.getElementById("agents-jobs-count");
  const cardsGrid = document.getElementById("agents-cards");
  const toast = document.getElementById("agents-toast");

  let activeStatus = "all";
  let activeMember = "all";
  let searchQuery = "";
  let toastTimer = null;

  const PAUSE_STATUS_ICON =
    '<img src="assets/agents/icon-pause.svg?v=3" width="14" height="14" alt="Paused" />';

  const COLUMN_WIDTHS = {
    name: "minmax(280px, 1fr)",
    type: "115px",
    status: "90px",
    schedule: "126px",
    runs: "50px",
    "last-run": "70px",
    apps: "140px",
    menu: "40px",
  };

  const hiddenColumns = new Set();

  function updateGridColumns() {
    const template = Object.entries(COLUMN_WIDTHS)
      .filter(([key]) => !hiddenColumns.has(key))
      .map(([, width]) => width)
      .join(" ");

    page.querySelectorAll(".agents-table__head, .agents-row").forEach((row) => {
      row.style.gridTemplateColumns = template;
    });

    page.querySelectorAll("[data-col]").forEach((cell) => {
      cell.hidden = hiddenColumns.has(cell.dataset.col);
    });
  }

  const agents = [
    {
      id: "editor",
      group: "scaling-studio",
      name: "The Editor (Performance)",
      desc: "Analyzes Seb's LinkedIn post performance. Scrapes engagement data, scores posts vs baseline, generates insights, and feeds tone recommendations back into the composer. Runs on-demand after publish and weekly for macro analysis.",
      type: "Hybrid",
      status: "paused",
      schedule: "Sun at 22:00",
      runs: "1",
      lastRun: "OK",
      lastRunOk: true,
      app: "Scaling Studio",
      progress: 100,
      progressMsg: "Weekly sweep #1 blocked by LinkedIn authentication…",
      timezone: "Europe/London",
      watchPaths: [{ path: "/scaling-studio/library/last-publish-result.json", match: "exact" }],
      connectedApp: {
        name: "Scaling Studio",
        watchLabel: "Watches",
        watchPath: "library/last-publish-result.json",
        href: "scaling-studio.html",
      },
      thinking: true,
      created: "13 May 2026",
      uuid: "74c49766-82c8-446b-b872-950c54eebf31",
      prompt:
        "Analyze Seb's LinkedIn post performance weekly. Scrape engagement metrics, score against baseline, and write insights to the tone library.",
    },
    {
      id: "github",
      group: "scaling-studio",
      name: "GitHub Activity Monitor",
      desc: "Posts drafted content to LinkedIn via browser automation when triggered. Opens a browser, navigates to LinkedIn, logs in with stored session, composes and publishes the post, captures the post URL, and updates the library.",
      type: "File-watch",
      status: "paused",
      schedule: "—",
      runs: "0",
      lastRun: "—",
      lastRunOk: false,
      app: "Scaling Studio",
      progress: null,
      progressMsg: "",
      watchPaths: [{ path: "/scaling-studio/drafts/*.md", match: "glob" }],
      connectedApp: {
        name: "Scaling Studio",
        watchLabel: "Watches",
        watchPath: "drafts/*.md",
        href: "scaling-studio.html",
      },
      created: "2 Apr 2026",
      uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      prompt: "When a new draft file appears in /scaling-studio/drafts/, publish it to LinkedIn.",
    },
    {
      id: "wire",
      group: "scaling-studio",
      name: "The Wire (Ingestion)",
      desc: "Pulls breaking tech/VC/policy news from RSS feeds, Substack, and X/Twitter accounts. Deduplicates, auto-tags (region, topic, breaking score), and writes stories into /scaling-studio/feed/ as JSON files for the Scaling Studio app to display.",
      type: "Recurring",
      status: "paused",
      schedule: "Every 15 minutes",
      runs: "93",
      lastRun: "OK",
      lastRunOk: true,
      app: "Scaling Studio",
      progress: 100,
      progressMsg: "Fetched all 6 live RSS feeds (Sifted, Tech.eu, The…",
      timezone: "Europe/London",
      connectedApp: {
        name: "Scaling Studio",
        watchLabel: "Writes to",
        watchPath: "feed/",
        href: "scaling-studio.html",
      },
      created: "28 Mar 2026",
      uuid: "b8e4f2a1-3c5d-4e6f-9012-3456789abcde",
      prompt: "Poll configured RSS feeds every 15 minutes. Deduplicate, tag, and write new stories as JSON.",
    },
    {
      id: "composer",
      name: "The Composer",
      desc: "Drafts LinkedIn posts in Seb's voice using the tone library and recent performance insights from The Editor.",
      type: "On-demand",
      status: "paused",
      schedule: "—",
      runs: "12",
      lastRun: "OK",
      lastRunOk: true,
      app: "Scaling Studio",
      progress: null,
      progressMsg: "",
      connectedApp: {
        name: "Scaling Studio",
        watchLabel: "Uses",
        watchPath: "tone-library/",
        href: "scaling-studio.html",
      },
      thinking: true,
      created: "18 May 2026",
      uuid: "c9f5a3b2-4d6e-5f70-a123-456789bcdef0",
      prompt: "Draft a LinkedIn post in Seb's voice using the tone library and latest Editor insights.",
    },
  ];

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("agents-toast--visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("agents-toast--visible");
    }, 2400);
  }

  function getVisibleAgents() {
    return agents.filter((agent) => {
      if (activeMember !== "all" && activeMember !== "seb") return false;
      if (activeStatus !== "all" && agent.status !== activeStatus) return false;
      if (searchQuery) {
        const haystack = `${agent.name} ${agent.desc} ${agent.type}`.toLowerCase();
        if (!haystack.includes(searchQuery)) return false;
      }
      return true;
    });
  }

  function updateJobsCount() {
    if (!jobsCount) return;
    const count = getVisibleAgents().length;
    jobsCount.textContent = `${count} job${count === 1 ? "" : "s"}`;
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveAgentId(id) {
    return id.endsWith("-stack") ? id.slice(0, -"-stack".length) : id;
  }

  function getAgentById(id) {
    return agents.find((a) => a.id === resolveAgentId(id));
  }

  const panelWrap = document.getElementById("agent-panel-wrap");
  const panelCloseBtn = document.getElementById("agent-panel-close");
  const panelMaximizeBtn = document.getElementById("agent-panel-maximize");
  const panelPromptToggle = document.getElementById("agent-panel-prompt-toggle");
  const panelPromptCopy = document.getElementById("agent-panel-prompt-copy");
  let openAgentId = null;
  let panelPromptText = "";

  function renderPanelStatus(status) {
    if (status === "paused") {
      return '<img src="assets/agents/icon-pause.svg?v=3" width="14" height="14" alt="Paused" />';
    }
    if (status === "running") {
      return '<span class="agents-row__text agents-row__text--dark">Running</span>';
    }
    return "";
  }

  function populateAgentPanel(agent) {
    const title = document.getElementById("agent-panel-title");
    const status = document.getElementById("agent-panel-status");
    const desc = document.getElementById("agent-panel-desc");
    const schedule = document.getElementById("agent-panel-schedule");
    const timezone = document.getElementById("agent-panel-timezone");
    const runs = document.getElementById("agent-panel-runs");
    const watchSection = document.getElementById("agent-panel-watch-section");
    const watchList = document.getElementById("agent-panel-watch-list");
    const appsSection = document.getElementById("agent-panel-apps-section");
    const appName = document.getElementById("agent-panel-app-name");
    const appMeta = document.getElementById("agent-panel-app-meta");
    const appLink = document.getElementById("agent-panel-app-link");
    const thinkingSection = document.getElementById("agent-panel-thinking-section");
    const created = document.getElementById("agent-panel-created");
    const uuid = document.getElementById("agent-panel-uuid");
    const promptSection = document.getElementById("agent-panel-prompt-section");
    const promptBody = document.getElementById("agent-panel-prompt-body");

    if (title) title.textContent = agent.name;
    if (status) status.innerHTML = renderPanelStatus(agent.status);
    if (desc) desc.textContent = agent.desc;
    if (schedule) schedule.textContent = agent.schedule;
    if (timezone) {
      timezone.textContent = agent.timezone ? `(${agent.timezone})` : "";
      timezone.hidden = !agent.timezone || agent.schedule === "—";
    }
    if (runs) runs.textContent = `${agent.runs} runs`;

    if (watchSection && watchList) {
      const paths = agent.watchPaths || [];
      watchSection.hidden = paths.length === 0;
      watchList.innerHTML = paths
        .map(
          (item) => `
        <div class="agent-panel__watch-row">
          <img src="assets/agents/icon-panel-eye.svg" width="13" height="13" alt="" />
          <img src="assets/agents/icon-panel-folder.svg" width="15" height="15" alt="" />
          <span class="agent-panel__watch-path">${escapeHtml(item.path)}</span>
          <span class="agent-panel__watch-match">${escapeHtml(item.match)}</span>
        </div>`
        )
        .join("");
    }

    if (appsSection && appName && appMeta && appLink) {
      const app = agent.connectedApp;
      appsSection.hidden = !app;
      if (app) {
        appName.textContent = app.name;
        appLink.href = app.href || "scaling-studio.html";
        appMeta.innerHTML = app.watchPath
          ? `<span class="agent-panel__app-meta-label">${escapeHtml(app.watchLabel)}</span><span aria-hidden="true">·</span><span class="agent-panel__app-meta-path">${escapeHtml(app.watchPath)}</span>`
          : "";
      }
    }

    if (thinkingSection) thinkingSection.hidden = !agent.thinking;

    if (created) created.textContent = agent.created ? `Created ${agent.created}` : "";
    if (uuid) uuid.textContent = agent.uuid ? `ID: ${agent.uuid}` : "";

    panelPromptText = agent.prompt || "";
    if (promptSection && promptBody && panelPromptToggle) {
      promptSection.hidden = !panelPromptText;
      promptBody.textContent = panelPromptText;
      promptBody.hidden = true;
      panelPromptToggle.setAttribute("aria-expanded", "false");
    }
  }

  function setSelectedAgentRow(agentId) {
    page.querySelectorAll(".agents-row[data-agent-id]").forEach((row) => {
      row.classList.toggle("agents-row--selected", resolveAgentId(row.dataset.agentId) === agentId);
    });
    cardsGrid?.querySelectorAll(".agents-card[data-agent-id]").forEach((card) => {
      card.classList.toggle("agents-card--selected", card.dataset.agentId === agentId);
    });
  }

  function openAgentPanel(agentId) {
    const agent = getAgentById(agentId);
    if (!agent || !panelWrap) return;

    openAgentId = resolveAgentId(agentId);
    populateAgentPanel(agent);
    page.classList.add("agents-page--panel-open");
    setSelectedAgentRow(openAgentId);

    const alreadyOpen = panelWrap.classList.contains("agent-panel-wrap--open");
    panelWrap.setAttribute("aria-hidden", "false");

    if (alreadyOpen) return;

    panelWrap.classList.remove("agent-panel-wrap--open");
    void panelWrap.offsetWidth;
    requestAnimationFrame(() => panelWrap.classList.add("agent-panel-wrap--open"));
  }

  function closeAgentPanel() {
    if (!panelWrap) return;
    panelWrap.classList.remove("agent-panel-wrap--open");
    page.classList.remove("agents-page--panel-open");
    setSelectedAgentRow(null);
    openAgentId = null;
    window.setTimeout(() => {
      if (!openAgentId) panelWrap.setAttribute("aria-hidden", "true");
    }, 360);
  }

  function bindAgentRowClicks() {
    page.querySelectorAll(".agents-row[data-agent-id]").forEach((row) => {
      if (row.dataset.panelBound === "true") return;
      row.dataset.panelBound = "true";
      row.addEventListener("click", (event) => {
        if (event.target.closest("button, a, input, textarea, .agents-row-menu")) return;
        openAgentPanel(row.dataset.agentId);
      });
    });
  }

  function setupAgentPanel() {
    if (!panelWrap) return;

    bindAgentRowClicks();

    panelCloseBtn?.addEventListener("click", closeAgentPanel);
    panelMaximizeBtn?.addEventListener("click", () => {
      if (openAgentId) showToast(`Opened ${getAgentById(openAgentId)?.name} in full view`);
    });

    panelWrap.querySelectorAll(".agent-panel__tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        panelWrap.querySelectorAll(".agent-panel__tab").forEach((t) => {
          const active = t === tab;
          t.classList.toggle("agent-panel__tab--active", active);
          t.setAttribute("aria-selected", active ? "true" : "false");
        });
      });
    });

    panelPromptToggle?.addEventListener("click", () => {
      const promptBody = document.getElementById("agent-panel-prompt-body");
      if (!promptBody) return;
      const expanded = panelPromptToggle.getAttribute("aria-expanded") === "true";
      panelPromptToggle.setAttribute("aria-expanded", expanded ? "false" : "true");
      promptBody.hidden = expanded;
    });

    panelPromptCopy?.addEventListener("click", async () => {
      if (!panelPromptText) return;
      try {
        await navigator.clipboard.writeText(panelPromptText);
        showToast("Prompt copied");
      } catch (_) {
        showToast("Could not copy prompt");
      }
    });

    cardsGrid?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const card = target.closest(".agents-card[data-agent-id]");
      if (!card || target.closest("button, a")) return;
      openAgentPanel(card.dataset.agentId);
    });
  }

  const SCALING_STUDIO_PILL_ICON = "assets/agents/icon-briefcase-pill.svg?v=2";

  function renderAppPill(app) {
    if (!app) return "";
    const isScalingStudio = app === "Scaling Studio";
    const pillClass = isScalingStudio
      ? "agents-app-pill agents-app-pill--operations"
      : "agents-app-pill";
    const icon = isScalingStudio
      ? SCALING_STUDIO_PILL_ICON
      : "assets/agents/icon-app-pill.svg";
    const previewAttr = isScalingStudio ? ' data-app-preview="scaling-studio"' : "";
    return `<button type="button" class="${pillClass}"${previewAttr}><img src="${icon}" width="10" height="10" alt="" />${escapeHtml(app)}</button>`;
  }

  function applyFilters() {
    const visibleIds = new Set(getVisibleAgents().map((a) => a.id));

    page.querySelectorAll(".agents-row[data-agent-id]").forEach((row) => {
      const id = row.dataset.agentId;
      const baseId = id.endsWith("-stack") ? id.slice(0, -"-stack".length) : id;
      row.classList.toggle("agents-row--hidden", !visibleIds.has(baseId));
    });

    page.querySelectorAll(".agents-group").forEach((group) => {
      const allRows = group.querySelectorAll(".agents-row[data-agent-id]");
      if (!allRows.length) return;
      const visibleRows = group.querySelectorAll(".agents-row[data-agent-id]:not(.agents-row--hidden)");
      group.hidden = visibleRows.length === 0;
    });

    if (cardsGrid) {
      cardsGrid.innerHTML = getVisibleAgents()
        .map(
          (agent) => `
        <article class="agents-card" data-agent-id="${agent.id}">
          <h3 class="agents-card__title">${escapeHtml(agent.name)}</h3>
          <p class="agents-card__desc">${escapeHtml(agent.desc)}</p>
          <div class="agents-card__meta">
            <span class="agents-type-pill"><span class="agents-type-pill__dot"></span>${escapeHtml(agent.type)}</span>
            ${renderAppPill(agent.app)}
          </div>
        </article>`
        )
        .join("");
    }

    updateJobsCount();
  }

  function setStatusFilter(status) {
    activeStatus = status;
    statusTabs.forEach((tab) => {
      const isActive = tab.dataset.status === status;
      tab.classList.toggle("agents-status-tab--active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    applyFilters();
  }

  function setupDropdown(dropdown, onSelect) {
    if (!dropdown) return;

    const trigger = dropdown.querySelector(".agents-dropdown__trigger");
    const options = dropdown.querySelectorAll(".agents-dropdown__option");

    trigger?.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = dropdown.classList.contains("agents-dropdown--open");
      closeAllDropdowns();
      closeAllRowMenus();
      if (!isOpen) dropdown.classList.add("agents-dropdown--open");
    });

    options.forEach((option) => {
      option.addEventListener("click", (event) => {
        event.stopPropagation();
        options.forEach((opt) => opt.classList.remove("agents-dropdown__option--selected"));
        option.classList.add("agents-dropdown__option--selected");
        const label = dropdown.querySelector(".agents-dropdown__label");
        if (label) {
          const labelText = option.dataset.label || option.textContent.trim();
          label.textContent = labelText;
        }
        dropdown.classList.remove("agents-dropdown--open");
        onSelect(option);
      });
    });
  }

  function closeAllDropdowns() {
    page.querySelectorAll(".agents-dropdown--open").forEach((el) => {
      el.classList.remove("agents-dropdown--open");
    });
  }

  let openRowMenu = null;

  function closeAllRowMenus() {
    if (!openRowMenu) return;
    const { menu, trigger, popover } = openRowMenu;
    menu.classList.remove("agents-row-menu--open");
    trigger.setAttribute("aria-expanded", "false");
    popover.hidden = true;
    openRowMenu = null;
  }

  function positionRowMenuPopover(menu, trigger, popover) {
    const triggerRect = trigger.getBoundingClientRect();
    popover.hidden = false;

    requestAnimationFrame(() => {
      const popoverRect = popover.getBoundingClientRect();
      let top = triggerRect.bottom + 4;
      let left = triggerRect.right - popoverRect.width;

      if (top + popoverRect.height > window.innerHeight - 8) {
        top = triggerRect.top - popoverRect.height - 4;
      }

      left = Math.max(8, Math.min(left, window.innerWidth - popoverRect.width - 8));
      top = Math.max(8, Math.min(top, window.innerHeight - popoverRect.height - 8));

      popover.style.top = `${top}px`;
      popover.style.left = `${left}px`;
    });
  }

  function toggleRowMenu(menu) {
    const trigger = menu.querySelector(".agents-row-menu__trigger");
    const popover = menu.querySelector(".agents-row-menu__popover");
    if (!trigger || !popover) return;

    const isOpen = menu.classList.contains("agents-row-menu--open");
    closeAllDropdowns();
    closeAllRowMenus();

    if (isOpen) return;

    menu.classList.add("agents-row-menu--open");
    trigger.setAttribute("aria-expanded", "true");
    positionRowMenuPopover(menu, trigger, popover);
    openRowMenu = { menu, trigger, popover };
  }

  const MENU_ACTION_LABELS = {
    "open-dashboard": "Opened in dashboard",
    usage: "Usage",
    optimise: "Optimise",
    settings: "Settings",
    delete: "Delete",
  };

  statusTabs.forEach((tab) => {
    tab.addEventListener("click", () => setStatusFilter(tab.dataset.status || "all"));
  });

  setupDropdown(memberDropdown, (option) => {
    activeMember = option.dataset.value || "all";
    applyFilters();
  });

  if (columnsDropdown) {
    const trigger = columnsDropdown.querySelector(".agents-dropdown__trigger");
    const options = columnsDropdown.querySelectorAll(".agents-dropdown__option");

    trigger?.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = columnsDropdown.classList.contains("agents-dropdown--open");
      closeAllDropdowns();
      closeAllRowMenus();
      if (!isOpen) columnsDropdown.classList.add("agents-dropdown--open");
    });

    options.forEach((option) => {
      option.addEventListener("click", (event) => {
        event.stopPropagation();
        option.classList.toggle("agents-dropdown__option--checked");
        const col = option.dataset.column;
        if (!col) return;
        if (option.classList.contains("agents-dropdown__option--checked")) {
          hiddenColumns.delete(col);
        } else {
          hiddenColumns.add(col);
        }
        updateGridColumns();
      });
    });
  }

  viewToggleBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view || "table";
      viewToggleBtns.forEach((b) => b.classList.toggle("agents-view-toggle__btn--active", b === btn));
      page.classList.toggle("agents-page--cards-view", view === "cards");
    });
  });

  searchInput?.addEventListener("input", () => {
    searchQuery = searchInput.value.trim().toLowerCase();
    applyFilters();
  });

  refreshBtn?.addEventListener("click", () => {
    refreshBtn.classList.add("agents-btn--loading");
    refreshBtn.disabled = true;
    window.setTimeout(() => {
      refreshBtn.classList.remove("agents-btn--loading");
      refreshBtn.disabled = false;
      showToast("Agents refreshed");
    }, 700);
  });

  newAgentBtn?.addEventListener("click", () => {
    showToast("New agent flow coming soon");
  });

  page.querySelectorAll(".agents-group__header").forEach((header) => {
    header.addEventListener("click", () => {
      const group = header.closest(".agents-group");
      group?.classList.toggle("agents-group--collapsed");
      header.setAttribute("aria-expanded", group?.classList.contains("agents-group--collapsed") ? "false" : "true");
    });
  });

  page.querySelectorAll(".agents-row__actions").forEach((actions) => {
    const row = actions.closest(".agents-row");
    const agentId = row?.dataset.agentId;
    const agent = getAgentById(agentId);
    if (!agent) return;

    actions.querySelector('[data-action="refresh"]')?.addEventListener("click", (event) => {
      event.stopPropagation();
      showToast(`${agent.name} refreshed`);
    });

    actions.querySelector('[data-action="run"]')?.addEventListener("click", (event) => {
      event.stopPropagation();
      agent.status = "running";
      const statusCell = row.querySelector(".agents-row__status");
      if (statusCell) {
        statusCell.innerHTML = '<span class="agents-row__text agents-row__text--dark">Running</span>';
      }
      showToast(`${agent.name} started`);
      applyFilters();
    });

    actions.querySelector('[data-action="open"]')?.addEventListener("click", (event) => {
      event.stopPropagation();
      showToast(`Opened ${agent.name}`);
    });
  });

  page.querySelectorAll(".agents-row-menu").forEach((menu) => {
    const row = menu.closest(".agents-row");
    const agentId = row?.dataset.agentId;
    const agent = getAgentById(agentId);
    if (!agent) return;

    const trigger = menu.querySelector(".agents-row-menu__trigger");
    trigger?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleRowMenu(menu);
    });

    menu.querySelectorAll("[data-menu-action]").forEach((item) => {
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        const action = item.dataset.menuAction;
        const label = MENU_ACTION_LABELS[action] || action;
        closeAllRowMenus();

        if (action === "delete") {
          showToast(`${agent.name} deleted`);
          return;
        }

        if (action === "settings") {
          showToast(`Settings for ${agent.name}`);
          return;
        }

        showToast(`${label} — ${agent.name}`);
      });
    });
  });

  document.addEventListener("click", (event) => {
    closeAllDropdowns();
    if (
      openRowMenu &&
      !openRowMenu.menu.contains(event.target) &&
      !openRowMenu.popover.contains(event.target)
    ) {
      closeAllRowMenus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (openAgentId) {
      closeAgentPanel();
      return;
    }
    closeAllDropdowns();
    closeAllRowMenus();
  });

  window.addEventListener(
    "scroll",
    () => {
      if (openRowMenu) {
        positionRowMenuPopover(openRowMenu.menu, openRowMenu.trigger, openRowMenu.popover);
      }
    },
    true
  );

  window.addEventListener("resize", () => {
    if (openRowMenu) {
      positionRowMenuPopover(openRowMenu.menu, openRowMenu.trigger, openRowMenu.popover);
    }
  });

  setupAppPreview();
  setupAgentPanel();

  applyFilters();

  window.AgentsPanel = {
    bindRowClicks: bindAgentRowClicks,
  };

  const APP_PREVIEWS = {
    "scaling-studio": {
      category: "operations",
      appSlug: "scaling-studio",
      href: "scaling-studio.html",
      title: "Scaling Studio",
      desc: "Content engine for Scaling Europe — news ingestion, LinkedIn publishing, and performance analytics.",
      thumb: "assets/category-panel/scaling-studio-thumb.png",
      folders: "32",
      settings: "3",
      team: "Team Zaro",
    },
  };

  const PREVIEW_CATEGORY_CLASSES = [
    "agents-app-preview--operations",
    "agents-app-preview--product",
    "agents-app-preview--sales",
    "agents-app-preview--marketing",
    "agents-app-preview--design",
    "agents-app-preview--hr",
    "agents-app-preview--finance",
    "agents-app-preview--personal",
  ];

  const PREVIEW_HIDE_DELAY_MS = 160;
  const PREVIEW_GAP_PX = 4;

  function setupAppPreview() {
    const preview = document.getElementById("agents-app-preview");
    if (!preview) return;

    const previewImage = preview.querySelector(".agents-app-preview__image");
    const previewTitle = preview.querySelector(".agents-app-preview__title");
    const previewDesc = preview.querySelector(".agents-app-preview__desc");
    const previewFolders = preview.querySelector(".agents-app-preview__folders");
    const previewSettings = preview.querySelector(".agents-app-preview__settings");
    const previewTeam = preview.querySelector(".agents-app-preview__team");

    let hideTimer = null;
    let activeAnchor = null;
    let activeSlug = null;

    function getPreviewMeta(slug) {
      return APP_PREVIEWS[slug] || null;
    }

    function updatePreviewContent(slug) {
      const meta = getPreviewMeta(slug);
      if (!meta) return false;

      activeSlug = slug;
      preview.href = meta.href;
      preview.setAttribute("aria-label", `Open ${meta.title}`);
      if (previewTitle) previewTitle.textContent = meta.title;
      if (previewDesc) previewDesc.textContent = meta.desc;
      if (previewImage) previewImage.src = meta.thumb;
      if (previewFolders) previewFolders.textContent = meta.folders;
      if (previewSettings) previewSettings.textContent = meta.settings;
      if (previewTeam) previewTeam.textContent = meta.team;

      preview.classList.remove(...PREVIEW_CATEGORY_CLASSES);
      preview.classList.add(`agents-app-preview--${meta.category || "product"}`);
      return true;
    }

    function navigateToApp(sourceEl) {
      const meta = activeSlug ? getPreviewMeta(activeSlug) : null;
      if (!meta) return;

      const el = sourceEl instanceof HTMLElement ? sourceEl : preview;

      if (meta.appSlug && window.PageNav?.navigateToApp) {
        window.PageNav.navigateToApp(meta.appSlug, el);
        return;
      }

      if (window.PageNav?.navigateToApps) {
        window.PageNav.navigateToApps(el);
        return;
      }

      window.location.href = meta.href;
    }

    function positionPreview(anchor) {
      preview.hidden = false;
      preview.classList.add("agents-app-preview--visible");
      preview.tabIndex = 0;

      requestAnimationFrame(() => {
        const anchorRect = anchor.getBoundingClientRect();
        const previewRect = preview.getBoundingClientRect();

        let top = anchorRect.top - previewRect.height - PREVIEW_GAP_PX;
        let left = anchorRect.left + anchorRect.width / 2 - previewRect.width / 2;

        if (top < 8) {
          top = anchorRect.bottom + PREVIEW_GAP_PX;
          preview.dataset.placement = "below";
        } else {
          preview.dataset.placement = "above";
        }

        left = Math.max(8, Math.min(left, window.innerWidth - previewRect.width - 8));
        top = Math.max(8, Math.min(top, window.innerHeight - previewRect.height - 8));

        preview.style.top = `${top}px`;
        preview.style.left = `${left}px`;
      });
    }

    function showPreview(anchor) {
      const slug = anchor.dataset.appPreview;
      if (!slug || !updatePreviewContent(slug)) return;

      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      activeAnchor = anchor;
      positionPreview(anchor);
    }

    function hidePreview() {
      hideTimer = window.setTimeout(() => {
        preview.classList.remove("agents-app-preview--visible");
        preview.hidden = true;
        preview.tabIndex = -1;
        activeAnchor = null;
        activeSlug = null;
      }, PREVIEW_HIDE_DELAY_MS);
    }

    function bindPill(pill) {
      if (!(pill instanceof HTMLElement) || pill.dataset.previewBound === "true") return;
      pill.dataset.previewBound = "true";

      pill.addEventListener("mouseenter", () => showPreview(pill));
      pill.addEventListener("focus", () => showPreview(pill));
      pill.addEventListener("mouseleave", hidePreview);
      pill.addEventListener("blur", (event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && preview.contains(next)) return;
        hidePreview();
      });

      pill.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        showPreview(pill);
        navigateToApp(pill);
      });
    }

    page.querySelectorAll("[data-app-preview]").forEach(bindPill);

    preview.addEventListener("mouseenter", () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    });

    preview.addEventListener("mouseleave", hidePreview);

    preview.addEventListener("click", (event) => {
      event.preventDefault();
      navigateToApp(preview);
    });

    preview.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      navigateToApp(preview);
    });

    preview.addEventListener("blur", (event) => {
      const next = event.relatedTarget;
      if (next instanceof Node && activeAnchor?.contains(next)) return;
      hidePreview();
    });

    window.addEventListener(
      "scroll",
      () => {
        if (activeAnchor) positionPreview(activeAnchor);
      },
      true
    );

    window.addEventListener("resize", () => {
      if (activeAnchor) positionPreview(activeAnchor);
    });

    const cardsGridEl = document.getElementById("agents-cards");
    if (cardsGridEl) {
      const observer = new MutationObserver(() => {
        cardsGridEl.querySelectorAll("[data-app-preview]").forEach(bindPill);
      });
      observer.observe(cardsGridEl, { childList: true });
    }
  }
})();
