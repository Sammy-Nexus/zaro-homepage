(function () {
  const CLICK_MODE = "panel";

  const CATEGORY_META = {
    sales: { title: "Sales", slug: "sales", viewAll: "View all sales apps" },
    personal: { title: "Personal", slug: "personal", viewAll: "View all personal apps" },
    marketing: { title: "Marketing", slug: "marketing", viewAll: "View all marketing apps" },
    product: { title: "Product", slug: "product", viewAll: "View all product apps" },
    operations: {
      title: "Operations",
      slug: "operations",
      viewAll: "View all operations apps",
    },
    design: { title: "Design", slug: "design", viewAll: "View all design apps" },
    hr: { title: "HR + Legal", slug: "hr", viewAll: "View all HR + Legal apps" },
    finance: { title: "Finance", slug: "finance", viewAll: "View all finance apps" },
  };

  const APP_NAMES_BY_CATEGORY = {
    sales: [
      "Pipeline Health Monitor",
      "Quota Attainment Tracker",
      "Deal Velocity Board",
      "Forecast Confidence Hub",
      "Territory Planner",
      "Win-Loss Insights",
      "Outbound Sequence Studio",
    ],
    personal: [
      "Morning Briefing Digest",
      "Habit Streak Tracker",
      "Weekend Planner",
      "Reading List Curator",
      "Budget Snapshot",
      "Focus Session Timer",
      "Travel Packing List",
    ],
    marketing: [
      "Campaign Pulse Dashboard",
      "Creative Asset Library",
      "Audience Segment Lab",
      "Content Calendar Grid",
      "Brand Voice Checker",
      "Influencer Roster",
      "Landing Page Experiments",
    ],
    product: [
      "Workspace Connection Map",
      "Release Train Control",
      "Feature Flag Console",
      "User Feedback Triage",
      "Roadmap Scenario Planner",
      "Experiment Results Hub",
      "Quality Signal Monitor",
    ],
    operations: [
      "Vendor SLA Monitor",
      "Incident Response Log",
      "Capacity Planning Grid",
      "Procurement Tracker",
      "Fleet Maintenance Board",
      "Compliance Checklist Hub",
      "Shift Handover Notes",
    ],
    design: [
      "Component Audit Board",
      "Prototype Review Room",
      "Design Token Explorer",
      "Accessibility Scan Hub",
      "Icon Library Manager",
      "Motion Spec Gallery",
      "Brand Asset Validator",
    ],
    hr: [
      "Onboarding Journey Map",
      "Policy Acknowledgement Hub",
      "Benefits Enrollment Guide",
      "Interview Scorecards",
      "Headcount Planning Grid",
      "Training Credits Tracker",
      "Employee Pulse Survey",
    ],
    finance: [
      "Cash Flow Forecaster",
      "Expense Approval Queue",
      "Invoice Aging Board",
      "Budget Variance Monitor",
      "Vendor Payment Calendar",
      "CapEx Request Tracker",
      "Month-End Close Checklist",
    ],
  };

  const APP_PREVIEW_SRC = "assets/category-panel/app-preview.png";
  const SCALING_STUDIO_THUMB_SRC = "assets/category-panel/scaling-studio-thumb.png";
  const SCALING_STUDIO_APP = {
    title: "Scaling Studio",
    appSlug: "scaling-studio",
    status: "Running",
    folders: "12",
    settings: "3",
    team: "Team Zaro",
    previewSrc: SCALING_STUDIO_THUMB_SRC,
    hideTeamTag: true,
  };
  let appPreviewReady = false;

  (function preloadAppPreview() {
    const probe = new Image();
    probe.decoding = "async";
    probe.src = APP_PREVIEW_SRC;
    if (probe.complete) {
      appPreviewReady = true;
      return;
    }
    probe.onload = () => {
      appPreviewReady = true;
    };
  })();

  const APP_STAT_TEMPLATES = [
    { status: "Running", folders: 32, settings: 12, team: "Team Zaro" },
    { status: "Running", folders: 18, settings: 6, team: "Team Zaro" },
    { status: "Running", folders: 24, settings: 9, team: "Team Zaro" },
    { status: "Running", folders: 21, settings: 8, team: "Team Zaro" },
    { status: "Running", folders: 15, settings: 5, team: "Team Zaro" },
    { status: "Running", folders: 27, settings: 11, team: "Team Zaro" },
  ];

  const main = document.querySelector(".main");
  const orbit = document.querySelector(".cards-orbit");
  const panel = document.getElementById("category-panel");
  const buildBtnLabel = panel?.querySelector(".category-panel__build-label");
  const viewAllBtn = panel?.querySelector(".category-panel__view-all-label");
  const viewAllButton = panel?.querySelector(".category-panel__view-all");
  const appsList = panel?.querySelector(".category-panel__apps");
  const appsScrollWrap = panel?.querySelector(".category-panel__apps-scroll");
  const emptyTitle = panel?.querySelector(".category-panel__empty-title");
  const emptySubtitle = panel?.querySelector(".category-panel__empty-subtitle");
  const tooltip = document.getElementById("category-card-tooltip");
  const cards = [...document.querySelectorAll(".category-card")];
  const clickModeSelect = document.getElementById("card-click-mode");

  if (!main || !panel || !cards.length) return;

  let selectedSlug = null;
  let bgDimTimer = null;
  let morphTimer = null;
  let dismissTimer = null;
  let lastAppsSlug = null;
  let appNamesGeneration = 0;
  const PANEL_MORPH_OPEN_MS = 520;
  const PANEL_MORPH_CLOSE_MS = 370;
  /** @type {Map<HTMLElement, { restX: number, restY: number, angle: number }> | null} */
  let restLayout = null;

  /** Start dim partway through ripple (~panel open), not after full wave. */
  const BG_DIM_WAVE_RATIO = 0.44;

  function clearBgDimSchedule() {
    if (bgDimTimer !== null) {
      clearTimeout(bgDimTimer);
      bgDimTimer = null;
    }
  }

  function applyBgDim() {
    if (main.classList.contains("main--category-selected")) {
      main.classList.add("main--category-selected--bg-dimmed");
    }
  }

  function scheduleBgDimAfterWave() {
    if (main.classList.contains("main--category-selected--bg-dimmed")) return;

    clearBgDimSchedule();

    queueMicrotask(() => {
      if (!main.classList.contains("main--category-selected")) return;

      const waveMs = window.RippleBackground?.waveDuration ?? 900;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const dimDelay = reduced ? 80 : Math.round(waveMs * BG_DIM_WAVE_RATIO);

      bgDimTimer = setTimeout(() => {
        bgDimTimer = null;
        applyBgDim();
      }, dimDelay);
    });
  }

  function getCardSlug(card) {
    const match = [...card.classList].find((cls) => cls.startsWith("category-card--"));
    return match ? match.replace("category-card--", "") : null;
  }

  function isEmptyCard(card) {
    if (card.classList.contains("category-card--empty")) return true;
    const countEl = card.querySelector(".category-card__count");
    return /^0\s+App/i.test(countEl?.textContent.trim() || "");
  }

  function buildLabelFor(meta) {
    const name = meta.title.toLowerCase();
    return `Build a ${name} app`;
  }

  function isScalingEuropeDemoEnabled() {
    if (window.ScalingDemo?.isEnabled) return window.ScalingDemo.isEnabled();
    return Boolean(document.getElementById("scaling-europe-demo")?.checked);
  }

  function getAppCount(card) {
    const countEl = card.querySelector(".category-card__count");
    if (countEl?.dataset.defaultCount) {
      const parsed = parseInt(countEl.dataset.defaultCount, 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
    const match = countEl?.textContent.trim().match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  function seededRandom(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function hashSlug(slug, generation) {
    let h = generation * 997;
    for (let i = 0; i < slug.length; i++) {
      h = (h * 31 + slug.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  function shouldShowScalingStudioApp() {
    return (
      isScalingEuropeDemoEnabled() ||
      Boolean(window.AltBuilder?.hasScalingStudioApp?.())
    );
  }

  function buildAppsForCount(count, categorySlug, nameGeneration) {
    if (categorySlug === "operations") {
      if (shouldShowScalingStudioApp()) {
        return [{ ...SCALING_STUDIO_APP }];
      }

      const pool = APP_NAMES_BY_CATEGORY.operations;
      const stats = APP_STAT_TEMPLATES[0];
      return [
        {
          title: pool[0],
          status: stats.status,
          folders: String(stats.folders),
          settings: String(stats.settings),
          team: stats.team,
        },
      ];
    }

    const pool =
      APP_NAMES_BY_CATEGORY[categorySlug] || APP_NAMES_BY_CATEGORY.product;
    const rand = seededRandom(hashSlug(categorySlug, nameGeneration));
    const names = [...pool].sort(() => rand() - 0.5);

    return Array.from({ length: count }, (_, index) => {
      const stats = APP_STAT_TEMPLATES[index % APP_STAT_TEMPLATES.length];
      const cycle = Math.floor(index / pool.length);
      const baseName = names[index % names.length];
      const title = cycle === 0 ? baseName : `${baseName} ${cycle + 1}`;

      return {
        title,
        status: stats.status,
        folders: String(stats.folders + cycle * 2),
        settings: String(stats.settings + cycle),
        team: stats.team,
      };
    });
  }

  function renderSkeletonRow(categorySlug) {
    const thumbClass = `category-panel__app-thumb-skeleton category-panel__app-thumb--${categorySlug}`;

    return `
      <div class="category-panel__app-row category-panel__app-row--skeleton" aria-hidden="true">
        <div class="${thumbClass}"></div>
        <div class="category-panel__app-body-skeleton">
          <span></span>
          <span></span>
        </div>
      </div>
    `;
  }

  function renderSkeletonList(count, categorySlug) {
    return Array.from({ length: count }, () => renderSkeletonRow(categorySlug)).join(
      ""
    );
  }

  function renderAppRow(app, categorySlug) {
    const thumbClass = categorySlug
      ? `category-panel__app-thumb category-panel__app-thumb--${categorySlug}${app.previewSrc ? " category-panel__app-thumb--custom-preview" : ""}`
      : `category-panel__app-thumb${app.previewSrc ? " category-panel__app-thumb--custom-preview" : ""}`;
    const previewSrc = app.previewSrc || APP_PREVIEW_SRC;
    const shotClass = app.previewSrc
      ? "category-panel__app-thumb-shot category-panel__app-thumb-shot--fit-width"
      : "category-panel__app-thumb-shot";
    const patternHtml = app.previewSrc
      ? ""
      : '<div class="category-panel__app-thumb-pattern" aria-hidden="true"></div>';
    const teamTagHtml = app.hideTeamTag
      ? ""
      : `<span class="category-panel__team-tag">${app.team}</span>`;
    const appSlugAttr = app.appSlug ? ` data-app-slug="${app.appSlug}"` : "";

    return `
      <button type="button" class="category-panel__app-row"${appSlugAttr}>
        <div class="${thumbClass}">
          ${patternHtml}
          <div class="${shotClass}">
            <img src="${previewSrc}" alt="" loading="eager" decoding="async" />
          </div>
        </div>
        <div class="category-panel__app-body">
          <p class="category-panel__app-title">${app.title}</p>
          <div class="category-panel__app-meta">
            <div class="category-panel__app-stats">
              <span class="category-panel__stat">
                <span class="category-panel__stat-dot" aria-hidden="true"></span>
                ${app.status}
              </span>
              <span class="category-panel__stat">
                <img src="assets/category-panel/icon-folder-small.svg" width="12" height="12" alt="" />
                ${app.folders}
              </span>
              <span class="category-panel__stat">
                <img src="assets/category-panel/icon-gear-small.svg" width="12" height="12" alt="" />
                ${app.settings}
              </span>
            </div>
            ${teamTagHtml}
          </div>
        </div>
      </button>
    `;
  }

  function paintFullApps(card, nameGeneration) {
    const slug = getCardSlug(card);
    const count = Math.max(1, getAppCount(card));
    const apps = buildAppsForCount(count, slug, nameGeneration);
    const rowsHtml = apps.map((app) => renderAppRow(app, slug)).join("");
    appsList.innerHTML = rowsHtml;
    appsList.classList.remove("category-panel__apps--loading");
    appsList.scrollTop = 0;
    requestAnimationFrame(() => {
      applyCompactPanelMorphHeight();
      if (
        main.classList.contains("main--category-morph-complete") ||
        !main.classList.contains("main--category-morphing")
      ) {
        syncPanelLayoutHeight();
      }
      updateAppsScrollFade();
    });
    return { slug, count, rowsHtml };
  }

  function renderFullApps(card, nameGeneration) {
    if (!appsList) return;

    const slug = getCardSlug(card);
    const count = Math.max(1, getAppCount(card));
    const reveal = () => paintFullApps(card, nameGeneration);

    if (appPreviewReady) {
      reveal();
      return;
    }

    appsList.classList.add("category-panel__apps--loading");
    appsList.innerHTML = renderSkeletonList(count, slug);

    const probe = new Image();
    const done = () => {
      appPreviewReady = true;
      reveal();
    };

    probe.onload = done;
    probe.onerror = done;
    probe.src = APP_PREVIEW_SRC;

    if (probe.complete) {
      done();
    }
  }

  function bumpAppNamesGeneration(slug) {
    if (slug !== lastAppsSlug) {
      lastAppsSlug = slug;
      appNamesGeneration += 1;
    }
  }

  function setPanelTargetMode(empty) {
    main.classList.toggle("main--category-panel-target-empty", empty);
    main.classList.toggle("main--category-panel-target-full", !empty);
  }

  function clearPanelAppCount() {
    if (!panel) return;
    panel.classList.remove(
      "category-panel--apps-1",
      "category-panel--apps-2",
      "category-panel--apps-3",
      "category-panel--apps-4"
    );
    main.classList.remove(
      "main--panel-apps-1",
      "main--panel-apps-2",
      "main--panel-apps-3",
      "main--panel-apps-4"
    );
  }

  function getPanelAppCount() {
    if (!panel) return 0;
    if (panel.classList.contains("category-panel--apps-1")) return 1;
    if (panel.classList.contains("category-panel--apps-2")) return 2;
    if (panel.classList.contains("category-panel--apps-3")) return 3;
    if (panel.classList.contains("category-panel--apps-4")) return 4;
    return 5;
  }

  function applyCompactPanelMorphHeight() {
    const count = getPanelAppCount();
    if (count === 0 || count > 4) return;

    const fullPanel = panel?.querySelector(".category-panel__full-panel");
    if (!fullPanel) return;

    const height = Math.ceil(fullPanel.scrollHeight);
    if (height < 180) return;

    panel.style.removeProperty("--category-full-height");
    main.style.setProperty("--panel-morph-height", `${height}px`);
  }

  function syncPanelLayoutHeight() {
    const fullPanel = panel?.querySelector(".category-panel__full-panel");
    if (!fullPanel || !panel?.classList.contains("category-panel--show-full")) return;

    if (getPanelAppCount() <= 4) {
      if (main.classList.contains("main--category-morphing")) return;
      requestAnimationFrame(() => applyCompactPanelMorphHeight());
      return;
    }

    // While morphing the panel is still chat-compact (~48px); measuring then crops the folder
    if (main.classList.contains("main--category-morphing")) return;

    const measure = () => {
      if (main.classList.contains("main--category-morphing")) return;

      const height = Math.ceil(fullPanel.scrollHeight);
      if (height < 200) return;

      panel.style.setProperty("--category-full-height", `${height}px`);
      main.style.setProperty("--panel-morph-height", `${height}px`);
    };

    requestAnimationFrame(measure);
  }

  function setPanelAppCount(count) {
    clearPanelAppCount();
    if (count > 4) return;
    panel?.classList.add(`category-panel--apps-${count}`);
    main.classList.add(`main--panel-apps-${count}`);
  }

  function startPanelMorph() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      main.classList.add("main--category-morph-complete");
      syncPanelLayoutHeight();
      return;
    }

    main.classList.add("main--category-morphing");
    main.classList.remove(
      "main--category-morph-complete",
      "main--category-morphing-expanded"
    );
    if (morphTimer !== null) clearTimeout(morphTimer);
    void main.offsetWidth;
    main.classList.add("main--category-morphing-expanded");
    morphTimer = window.setTimeout(() => {
      main.classList.remove(
        "main--category-morphing",
        "main--category-morphing-expanded"
      );
      main.classList.add("main--category-morph-complete");
      morphTimer = null;
      syncPanelLayoutHeight();
    }, PANEL_MORPH_OPEN_MS);
  }

  function clearPanelMorphTimers() {
    if (morphTimer !== null) {
      clearTimeout(morphTimer);
      morphTimer = null;
    }
    if (dismissTimer !== null) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
  }

  function clearPanelMorph() {
    clearPanelMorphTimers();
    main.classList.remove(
      "main--category-morphing",
      "main--category-morphing-expanded",
      "main--category-morph-complete",
      "main--category-morph-out",
      "main--category-dismissing",
      "main--category-dismissing-shrink",
      "main--category-panel-target-empty",
      "main--category-panel-target-full"
    );
  }

  function startPanelMorphOut(done) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      done();
      return;
    }

    clearPanelMorphTimers();
    main.classList.remove(
      "main--category-morphing",
      "main--category-morph-complete",
      "main--category-selected",
      "main--category-selected--bg-dimmed"
    );
    clearRadialPush();
    cards.forEach((card) => {
      card.classList.remove("category-card--selected");
      card.setAttribute("aria-pressed", "false");
    });

    showChatCompact();
    main.classList.add("main--category-dismissing");
    main.classList.remove("main--category-dismissing-shrink");
    void main.offsetWidth;
    main.classList.add("main--category-dismissing-shrink");

    dismissTimer = window.setTimeout(() => {
      dismissTimer = null;
      done();
    }, PANEL_MORPH_CLOSE_MS + 40);
  }

  function getCardTitle(card) {
    const slug = getCardSlug(card);
    if (slug && CATEGORY_META[slug]) return CATEGORY_META[slug].title;
    return card.querySelector(".category-card__title")?.textContent.trim() || "";
  }

  function updatePanelContent(card) {
    const slug = getCardSlug(card);
    const meta = slug ? CATEGORY_META[slug] : null;
    if (!meta || !panel) return;

    const empty = isEmptyCard(card);
    const prevMode = panel.classList.contains("category-panel--show-empty")
      ? "empty"
      : panel.classList.contains("category-panel--show-full")
        ? "full"
        : null;
    const nextMode = empty ? "empty" : "full";

    panel.dataset.category = slug;
    panel.setAttribute("aria-label", `${meta.title} category`);

    if (nextMode === "empty") {
      clearPanelAppCount();
      if (prevMode !== "empty") {
        panel.classList.remove("category-panel--show-full");
        panel.classList.add("category-panel--show-empty");
      }
      if (emptyTitle) emptyTitle.textContent = "No apps yet.";
      if (emptySubtitle) {
        emptySubtitle.textContent = `Looks like you haven’t built any ${meta.title} apps yet.`;
      }
      if (buildBtnLabel) buildBtnLabel.textContent = buildLabelFor(meta);
    } else {
      if (prevMode !== "full") {
        panel.classList.remove("category-panel--show-empty");
        panel.classList.add("category-panel--show-full");
      }
      setPanelAppCount(getAppCount(card));
      bumpAppNamesGeneration(slug);
      renderFullApps(card, appNamesGeneration);
      if (viewAllBtn) viewAllBtn.textContent = meta.viewAll;
    }
  }

  function hideCategoryTooltip() {
    if (!tooltip) return;
    tooltip.hidden = true;
    tooltip.classList.remove("is-visible");
    tooltip.textContent = "";
  }

  function showCategoryTooltip(card) {
    if (!tooltip || !main.classList.contains("main--category-selected")) return;
    if (card.classList.contains("category-card--selected")) {
      hideCategoryTooltip();
      return;
    }

    const label = getCardTitle(card);
    if (!label) return;

    const rect = card.getBoundingClientRect();
    tooltip.textContent = label;
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top}px`;
    tooltip.hidden = false;
    requestAnimationFrame(() => tooltip.classList.add("is-visible"));
  }

  function captureRestLayout() {
    if (!orbit || main.classList.contains("main--category-selected")) return;

    const cx = orbit.clientWidth / 2;
    const cy = orbit.clientHeight / 2;
    const cardMap = new Map();

    cards.forEach((card) => {
      const restX = card.offsetLeft + card.offsetWidth / 2;
      const restY = card.offsetTop + card.offsetHeight / 2;
      cardMap.set(card, {
        restX,
        restY,
        angle: Math.atan2(restY - cy, restX - cx),
      });
    });

    restLayout = cardMap;
  }

  /** Resting orbit radius × factor — cards push outward on category click. */
  const RING_EXPAND_FACTOR = 1.35;
  const RING_EXPAND_RADIUS_OFFSET = 60;
  const APPS_SCROLL_FADE_THRESHOLD = 16;

  function updateAppsScrollFade() {
    if (!appsList || !appsScrollWrap) return;

    const count = appsList.querySelectorAll(
      ".category-panel__app-row:not(.category-panel__app-row--skeleton)"
    ).length;
    if (count > 0 && count <= 4) {
      appsScrollWrap.classList.remove("category-panel__apps-scroll--fade");
      return;
    }

    const hasOverflow = appsList.scrollHeight > appsList.clientHeight + 1;
    const nearBottom =
      appsList.scrollTop + appsList.clientHeight >=
      appsList.scrollHeight - APPS_SCROLL_FADE_THRESHOLD;

    appsScrollWrap.classList.toggle(
      "category-panel__apps-scroll--fade",
      hasOverflow && !nearBottom
    );
  }

  function getExpandedRingRadiusPx(cx, cy) {
    if (!restLayout || restLayout.size === 0) {
      const size = Math.min(orbit.clientWidth, orbit.clientHeight);
      const restR = size * 0.4;
      return Math.max(restR, restR * RING_EXPAND_FACTOR - RING_EXPAND_RADIUS_OFFSET);
    }

    let maxRestR = 0;
    for (const { restX, restY } of restLayout.values()) {
      maxRestR = Math.max(maxRestR, Math.hypot(restX - cx, restY - cy));
    }
    return Math.max(
      maxRestR,
      maxRestR * RING_EXPAND_FACTOR - RING_EXPAND_RADIUS_OFFSET
    );
  }

  function clearRadialPush() {
    cards.forEach((card) => {
      card.style.removeProperty("--orbit-radial-x");
      card.style.removeProperty("--orbit-radial-y");
    });
  }

  /** Move every card (including selected) onto the same ring radius. */
  function applyOrbitRing() {
    if (!orbit) return;
    if (!restLayout) captureRestLayout();
    if (!restLayout) return;

    const cx = orbit.clientWidth / 2;
    const cy = orbit.clientHeight / 2;
    const ringR = getExpandedRingRadiusPx(cx, cy);

    cards.forEach((card) => {
      const rest = restLayout.get(card);
      if (!rest) return;

      const targetX = cx + ringR * Math.cos(rest.angle);
      const targetY = cy + ringR * Math.sin(rest.angle);
      const dx = targetX - rest.restX;
      const dy = targetY - rest.restY;

      card.style.setProperty("--orbit-radial-x", `${dx}px`);
      card.style.setProperty("--orbit-radial-y", `${dy}px`);
    });
  }

  function syncOrbitRingAfterLayout() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => applyOrbitRing());
    });
  }

  function showChatCompact() {
    main.classList.remove("main--chat-active");
    const expanded = document.querySelector(".chat-bar__expanded");
    const compactRow = document.querySelector(".chat-bar__compact");
    if (expanded) expanded.setAttribute("aria-hidden", "true");
    if (compactRow) compactRow.setAttribute("aria-hidden", "false");
  }

  function deactivateChatIfNeeded() {
    if (main.classList.contains("main--chat-active")) {
      const compactInput = document.querySelector(".chat-bar__input-compact");
      if (compactInput) compactInput.blur();
      showChatCompact();
    }
  }

  function getSelectedCard() {
    if (!selectedSlug) return null;
    return cards.find((card) => getCardSlug(card) === selectedSlug) || null;
  }

  function refreshCurrentApps() {
    const card = getSelectedCard();
    if (!card || isEmptyCard(card)) return;

    bumpAppNamesGeneration(getCardSlug(card));
    renderFullApps(card, appNamesGeneration);
  }

  function selectCard(card, options = {}) {
    const slug = getCardSlug(card);
    if (!slug) return;

    const alreadyOpen = main.classList.contains("main--category-selected");
    const immediateBgDim = Boolean(options.immediateBgDim);

    deactivateChatIfNeeded();
    hideCategoryTooltip();

    cards.forEach((c) => {
      c.classList.toggle("category-card--selected", c === card);
      c.setAttribute("aria-pressed", c === card ? "true" : "false");
    });

    selectedSlug = slug;
    const empty = isEmptyCard(card);
    setPanelTargetMode(empty);
    updatePanelContent(card);
    main.classList.add("main--category-selected");
    panel.setAttribute("aria-hidden", "false");

    if (!alreadyOpen) {
      applyCompactPanelMorphHeight();
      startPanelMorph();
      if (immediateBgDim) {
        clearBgDimSchedule();
        applyBgDim();
      } else {
        scheduleBgDimAfterWave();
      }
    } else {
      main.classList.add("main--category-morph-complete");
      applyCompactPanelMorphHeight();
      if (immediateBgDim) {
        clearBgDimSchedule();
        applyBgDim();
      }
    }

    syncOrbitRingAfterLayout();
  }

  function finishDeselect() {
    clearBgDimSchedule();
    clearPanelMorph();
    clearRadialPush();
    hideCategoryTooltip();
    selectedSlug = null;
    lastAppsSlug = null;
    main.classList.remove(
      "main--category-selected",
      "main--category-selected--bg-dimmed"
    );
    panel.classList.remove("category-panel--show-empty", "category-panel--show-full");
    clearPanelAppCount();
    panel.style.removeProperty("--category-full-height");
    main.style.removeProperty("--panel-morph-height");
    panel.setAttribute("aria-hidden", "true");
    if (appsList) {
      appsList.classList.remove("category-panel__apps--loading");
      appsList.innerHTML = "";
    }
    cards.forEach((card) => {
      card.classList.remove("category-card--selected");
      card.setAttribute("aria-pressed", "false");
    });
  }

  function deselect() {
    if (main.classList.contains("main--category-dismissing")) {
      return;
    }

    if (!main.classList.contains("main--category-selected")) {
      finishDeselect();
      return;
    }

    if (main.classList.contains("main--category-morphing")) {
      clearPanelMorphTimers();
      main.classList.remove("main--category-morphing");
      main.classList.add("main--category-morph-complete");
    }

    startPanelMorphOut(finishDeselect);
  }

  function getClickMode() {
    return clickModeSelect?.value || CLICK_MODE;
  }

  function handleCardClick(event) {
    if (getClickMode() !== "panel") return;

    const card = event.currentTarget;
    if (!(card instanceof HTMLElement)) return;

    if (selectedSlug === getCardSlug(card)) {
      deselect();
      return;
    }

    selectCard(card);
  }

  cards.forEach((card) => {
    const title = getCardTitle(card);
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-pressed", "false");
    if (title) card.setAttribute("aria-label", title);
    card.addEventListener("click", handleCardClick);
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      handleCardClick({ currentTarget: card });
    });
    card.addEventListener("mouseenter", () => showCategoryTooltip(card));
    card.addEventListener("mouseleave", hideCategoryTooltip);
    card.addEventListener("focus", () => showCategoryTooltip(card));
    card.addEventListener("blur", hideCategoryTooltip);
  });

  window.addEventListener(
    "scroll",
    () => {
      if (!tooltip || tooltip.hidden) return;
      const hovered = cards.find(
        (card) =>
          main.classList.contains("main--category-selected") &&
          !card.classList.contains("category-card--selected") &&
          card.matches(":hover")
      );
      if (hovered) showCategoryTooltip(hovered);
    },
    true
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && selectedSlug) {
      event.preventDefault();
      deselect();
    }
  });

  document.addEventListener("mousedown", (event) => {
    if (!selectedSlug) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest(".category-card")) return;
    if (target.closest(".category-panel")) return;
    if (target.closest(".demo-modal")) return;
    if (target.closest("#demo-modal-trigger")) return;
    deselect();
  });

  window.addEventListener("resize", () => {
    if (selectedSlug) {
      applyOrbitRing();
      updateAppsScrollFade();
      return;
    }
    restLayout = null;
    captureRestLayout();
  });

  if (appsList) {
    appsList.addEventListener("scroll", updateAppsScrollFade, { passive: true });
    appsList.addEventListener("click", (event) => {
      const row = event.target.closest(
        ".category-panel__app-row:not(.category-panel__app-row--skeleton)"
      );
      if (!row || !appsList.contains(row)) return;
      event.preventDefault();
      event.stopPropagation();
      const slug = row.dataset.appSlug;
      if (slug && window.PageNav?.navigateToApp) {
        window.PageNav.navigateToApp(slug, row);
        return;
      }
      window.PageNav?.navigateToApps(row);
    });
  }

  if (viewAllButton) {
    viewAllButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.PageNav?.navigateToApps();
    });
  }

  if (document.readyState === "complete") {
    captureRestLayout();
  } else {
    window.addEventListener("load", captureRestLayout, { once: true });
  }

  function selectBySlug(slug, options = {}) {
    const card = cards.find((item) => getCardSlug(item) === slug);
    if (card) selectCard(card, options);
  }

  window.CategoryPanel = {
    select: selectCard,
    selectBySlug,
    deselect,
    refreshApps: refreshCurrentApps,
  };
})();
