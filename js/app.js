let peopleIndex = [];
let currentPersonId = null;
let personSearchTerm = '';
const PERSON_HISTORY_KEY = 'hackmitViewedPeople';
const PERSON_HISTORY_LIMIT = 8;
const SIDEBAR_PAGE_SIZE = 4;

let activeSidebarTab = 'people';
let sidebarTabPage = {
  history: 0,
  people: 0
};

let isSnapScrolling = false;
let currentStepIndex = 0;
let wheelCooldown = false;
let snapModeEnabled = true;
let boundaryLockDirection = null;
let boundaryLockTimer = null;

function getSteps() {
  return Array.from(document.querySelectorAll('.step'));
}

function getPersonById(personId) {
  return peopleIndex.find(person => person.id === personId) || null;
}

function flattenPersonTags(person) {
  const tags = person?.tags || {};
  return Object.values(tags)
    .flatMap(value => Array.isArray(value) ? value : [value])
    .filter(Boolean);
}

function getPersonSearchText(person) {
  return [
    person.name,
    person.id,
    person.years,
    person.summary,
    ...flattenPersonTags(person)
  ]
    .filter(Boolean)
    .join(' | ')
    .toLowerCase();
}

function getBriefSummary(person) {
  const summary = (person?.summary || '').trim();
  if (!summary) return '';
  const sentence = summary.split(/(?<=[.!?])\s+/)[0] || summary;
  return sentence.length > 110 ? sentence.slice(0, 107) + '...' : sentence;
}

function getFilteredPeople() {
  const query = personSearchTerm.trim().toLowerCase();
  if (!query) return [];

  return peopleIndex.filter(person => {
    const haystack = getPersonSearchText(person);
    return haystack.includes(query.replace(/^#/, ''));
  });
}

function getViewedPeopleHistory() {
  try {
    const raw = localStorage.getItem(PERSON_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to read viewed people history:', error);
    return [];
  }
}

function saveViewedPeopleHistory(historyIds) {
  try {
    localStorage.setItem(PERSON_HISTORY_KEY, JSON.stringify(historyIds.slice(0, PERSON_HISTORY_LIMIT)));
  } catch (error) {
    console.warn('Failed to save viewed people history:', error);
  }
}

function pushViewedPerson(personId) {
  const nextHistory = [personId, ...getViewedPeopleHistory().filter(id => id !== personId)]
    .slice(0, PERSON_HISTORY_LIMIT);
  saveViewedPeopleHistory(nextHistory);
}

function escapeAttr(value) {
  return String(value || '').replace(/"/g, '&quot;');
}

function createTagPills(tags = [], clickable = false) {
  if (clickable) {
    return tags.map(tag => `<button type="button" class="person-tag clickable" data-tag="${escapeAttr(tag)}">${tag}</button>`).join('');
  }
  return tags.map(tag => `<span class="person-tag">${tag}</span>`).join('');
}

function scoreRecommendedPeople(basePerson) {
  const baseTags = new Set(flattenPersonTags(basePerson).map(tag => String(tag).toLowerCase()));
  return peopleIndex
    .filter(person => person.id !== basePerson.id)
    .map(person => {
      const tags = flattenPersonTags(person);
      let score = 0;
      for (const tag of tags) {
        if (baseTags.has(String(tag).toLowerCase())) score += 1;
      }
      return { person, score };
    })
    .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name))
    .map(item => item.person);
}

function getPagedItems(items, tab) {
  const totalPages = Math.max(1, Math.ceil(items.length / SIDEBAR_PAGE_SIZE));
  sidebarTabPage[tab] = Math.min(sidebarTabPage[tab] || 0, totalPages - 1);
  const start = (sidebarTabPage[tab] || 0) * SIDEBAR_PAGE_SIZE;
  return {
    totalPages,
    page: sidebarTabPage[tab] || 0,
    items: items.slice(start, start + SIDEBAR_PAGE_SIZE)
  };
}

function renderTopShelf() {
  const listEl = document.getElementById('sidebarShelfList');
  const metaEl = document.getElementById('sidebarShelfMeta');
  const prevBtn = document.getElementById('sidebarShelfPrev');
  const nextBtn = document.getElementById('sidebarShelfNext');
  if (!listEl || !metaEl || !prevBtn || !nextBtn) return;

  const currentPerson = getPersonById(currentPersonId);
  const historyPeople = getViewedPeopleHistory().map(getPersonById).filter(Boolean);
    const allPeople = [...peopleIndex].sort((a, b) => {
    const countryA = (a.tags?.countries?.[0] || '');
    const countryB = (b.tags?.countries?.[0] || '');
    return countryA.localeCompare(countryB) || a.name.localeCompare(b.name);
  });
  const sourceItems = activeSidebarTab === 'history' ? historyPeople : allPeople;
  const emptyMessage = activeSidebarTab === 'history'
    ? 'Viewed people will appear here.'
    : 'All people will appear here.';

  const paged = getPagedItems(sourceItems, activeSidebarTab);
  metaEl.textContent = sourceItems.length ? `Page ${paged.page + 1}/${paged.totalPages}` : 'No entries';
  prevBtn.disabled = paged.page <= 0;
  nextBtn.disabled = paged.page >= paged.totalPages - 1 || !sourceItems.length;

  if (!sourceItems.length) {
    listEl.innerHTML = `<div class="history-empty">${emptyMessage}</div>`;
    return;
  }

  listEl.innerHTML = paged.items.map(person => {
    const pills = createTagPills(flattenPersonTags(person).slice(0, 3), false);
    return `
      <button type="button" class="mini-person-row ${person.id === currentPersonId ? 'active' : ''}" data-person-id="${person.id}">
        <img src="${person.portrait}" alt="${person.name}" />
        <span class="mini-person-main">
          <span class="mini-person-head">
            <span class="mini-person-name">${person.name}</span>
            <span class="mini-person-pills">${pills}</span>
          </span>
        </span>
      </button>
    `;
  }).join('');
}

function renderPeopleList() {
  const listEl = document.getElementById('personList');
  const countEl = document.getElementById('personResultCount');
  const shellEl = document.getElementById('personSearchResultsShell');
  if (!listEl || !shellEl) return;

  const query = personSearchTerm.trim();
  if (!query) {
    shellEl.classList.add('is-empty');
    if (countEl) countEl.textContent = '';
    listEl.innerHTML = '';
    return;
  }

  const filteredPeople = getFilteredPeople().slice(0, 4);
  shellEl.classList.remove('is-empty');
  if (countEl) countEl.textContent = `${filteredPeople.length} result${filteredPeople.length === 1 ? '' : 's'}`;

  if (!filteredPeople.length) {
    listEl.innerHTML = `<div class="person-empty">No matching person.</div>`;
    return;
  }

  listEl.innerHTML = filteredPeople.map(person => {
    const tags = flattenPersonTags(person).slice(0, 3);
    return `
      <button type="button" class="person-card ${person.id === currentPersonId ? 'active' : ''}" data-person-id="${person.id}">
        <img class="person-card-avatar" src="${person.portrait}" alt="${person.name}" />
        <span class="person-card-main">
          <span class="person-card-head">
            <span class="person-card-name">${person.name}</span>
            <span class="person-card-tags">${createTagPills(tags, false)}</span>
          </span>
        </span>
      </button>
    `;
  }).join('');
}

function renderSidebarCurrentPerson() {
  const mount = document.getElementById('sidebarCurrentPerson');
  if (!mount) return;

  const currentPerson = getPersonById(currentPersonId);
  if (!currentPerson) {
    mount.innerHTML = '';
    mount.classList.add('is-empty');
    return;
  }

  mount.classList.remove('is-empty');
  const pills = createTagPills(flattenPersonTags(currentPerson).slice(0, 3), false);
  mount.innerHTML = `
    <button type="button" class="mini-person-row featured-person-row active" data-person-id="${currentPerson.id}">
      <img src="${currentPerson.portrait}" alt="${currentPerson.name}" />
      <span class="mini-person-main">
        <span class="mini-person-head">
          <span class="mini-person-name">${currentPerson.name}</span>
          <span class="mini-person-pills">${pills}</span>
        </span>
      </span>
    </button>
  `;
}

// Refresh the People shelf and related controls after selection or mode changes.
function rerenderSidebar() {
  renderPeopleList();
  renderSidebarCurrentPerson();
  renderTopShelf();
  const routeToggle = document.getElementById('sidebarRouteToggle');
  if (routeToggle) routeToggle.disabled = !currentPersonId;
  const storyDock = document.getElementById('storyVisibilityDock');
  if (storyDock) storyDock.style.display = currentPersonId ? '' : 'none';
}
window.rerenderSidebar = rerenderSidebar;

// Collapse the People panel into a slim reopen tab pinned to the left edge.
function setSidebarCollapsed(collapsed) {
  const sidebar = document.getElementById('person-sidebar');
  if (!sidebar) return;

  sidebar.classList.toggle('collapsed', collapsed);
  const toggle = document.getElementById('personSidebarToggle');
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.innerHTML = collapsed ? '<span class="sidebar-toggle-label">People</span>' : '<span class="sidebar-toggle-label">Hide</span>';
    toggle.setAttribute('aria-label', collapsed ? 'Show People panel' : 'Hide People panel');
    toggle.title = collapsed ? 'Show People panel' : 'Hide People panel';
  }

  let collapsedDock = document.getElementById('personSidebarCollapsedDock');
  if (!collapsedDock) {
    collapsedDock = document.createElement('button');
    collapsedDock.id = 'personSidebarCollapsedDock';
    collapsedDock.type = 'button';
    collapsedDock.setAttribute('aria-label', 'Show People panel');
    collapsedDock.innerHTML = '<span class="sidebar-toggle-label">People</span>';
    collapsedDock.addEventListener('click', () => setSidebarCollapsed(false));
    document.body.appendChild(collapsedDock);
  }
  collapsedDock.classList.toggle('active', !!collapsed);
}

function ensureLandingHero() {
  let hero = document.getElementById('landingHero');
  if (!hero) {
    hero = document.createElement('div');
    hero.id = 'landingHero';
    hero.className = 'landing-hero';
    hero.addEventListener('click', () => exitLandingMode());
    document.body.appendChild(hero);
  }
  hero.innerHTML = `
    <div class="landing-hero-inner">
      <div class="landing-hero-title">PastPath</div>
      <div class="landing-hero-subtitle">WWIl Biography Map</div>
      <div class="landing-hero-hint">Scroll down to begin</div>
    </div>
  `;
}

function syncLandingModeVisibility() {
  const isLanding = document.body.classList.contains('landing-mode');
  const ids = ['person-search-dock', 'person-sidebar', 'storyVisibilityDock', 'story'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (isLanding) {
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';
    } else {
      el.style.visibility = '';
      el.style.pointerEvents = '';
    }
  });
  const collapsedDock = document.getElementById('personSidebarCollapsedDock');
  if (collapsedDock) {
    if (isLanding) {
      collapsedDock.style.visibility = 'hidden';
      collapsedDock.style.pointerEvents = 'none';
    } else {
      collapsedDock.style.visibility = '';
      collapsedDock.style.pointerEvents = '';
    }
  }
}

function exitLandingMode() {
  document.body.classList.remove('landing-mode');
  syncLandingModeVisibility();
}

function enterLandingMode() {
  ensureLandingHero();
  document.body.classList.add('landing-mode');
  syncLandingModeVisibility();
}

function bindLandingModeDismiss() {
  if (window.__landingDismissBound) return;
  window.__landingDismissBound = true;

  window.addEventListener('wheel', event => {
    if (!document.body.classList.contains('landing-mode')) return;
    if ((event.deltaY || 0) > 6) {
      event.preventDefault();
      exitLandingMode();
    }
  }, { passive: false });

  let touchStartY = null;
  window.addEventListener('touchstart', event => {
    if (!document.body.classList.contains('landing-mode')) return;
    touchStartY = event.touches && event.touches[0] ? event.touches[0].clientY : null;
  }, { passive: true });

  window.addEventListener('touchend', event => {
    if (!document.body.classList.contains('landing-mode')) return;
    const endY = event.changedTouches && event.changedTouches[0] ? event.changedTouches[0].clientY : null;
    if (touchStartY !== null && endY !== null && (touchStartY - endY) > 24) {
      exitLandingMode();
    }
    touchStartY = null;
  }, { passive: true });
}

function resetToUnselectedState() {
  exitLandingMode();
  currentPersonId = null;
  personSearchTerm = '';
  const searchInput = document.getElementById('personSearchInput');
  if (searchInput) searchInput.value = '';

  if (typeof window.hideFullRouteOverview === 'function') {
    window.hideFullRouteOverview();
  }
  if (typeof window.showIdleMap === 'function') {
    window.showIdleMap();
  }

  const storyEl = document.getElementById('story');
  if (storyEl) {
    storyEl.classList.remove('overview-mode');
    storyEl.innerHTML = '';
  }

  window.currentPerson = null;
  window.config = null;
  window.pendingInitialChapterId = null;
  window.isSwitchingPerson = false;
  rerenderSidebar();
}

function loadPerson(personId) {
  exitLandingMode();
  document.body.classList.add('switching-person');
  window.isSwitchingPerson = true;
  window.pendingInitialChapterId = null;

  const storyEl = document.getElementById('story');
  if (storyEl) {
    storyEl.classList.remove('overview-mode');
    storyEl.innerHTML = '';
  }

  currentStepIndex = 0;
  snapModeEnabled = true;
  boundaryLockDirection = null;

  if (boundaryLockTimer) {
    clearTimeout(boundaryLockTimer);
    boundaryLockTimer = null;
  }

  if (window.storyScroller && typeof window.storyScroller.destroy === 'function') {
    window.storyScroller.destroy();
    window.storyScroller = null;
  }

  window.scrollTo({ top: 0, behavior: 'auto' });

  fetch(`./data/people/${personId}.json?ts=` + Date.now())
    .then(response => response.json())
    .then(personData => {
      currentPersonId = personId;
      pushViewedPerson(personId);
      rerenderSidebar();

      window.currentPerson = personData;
      window.config = buildConfig(personData);
      const firstRealChapter = (window.config.chapters || []).find(chapter => !chapter.isOverview);
      window.pendingInitialChapterId = firstRealChapter ? firstRealChapter.id : null;

      initStory();

      requestAnimationFrame(() => {
        const firstRealStep = document.querySelector('.step:not(.overview-step)');

        if (firstRealStep) {
          firstRealStep.scrollIntoView({
            behavior: 'auto',
            block: 'center'
          });
        } else {
          window.scrollTo({ top: 0, behavior: 'auto' });
        }

        requestAnimationFrame(() => {
          attachWheelSnap();
          window.isSwitchingPerson = false;
          document.body.classList.remove('switching-person');
        });
      });
    })
    .catch(error => {
      console.error(`Failed to load person file for "${personId}":`, error);
      window.pendingInitialChapterId = null;
      window.isSwitchingPerson = false;
      document.body.classList.remove('switching-person');
    });
}

function bindSidebarEvents() {
  const searchInput = document.getElementById('personSearchInput');
  const clearButton = document.getElementById('personSearchClear');
  const toggleButton = document.getElementById('personSidebarToggle');
  const sidebar = document.getElementById('person-sidebar');
  const shelfTabs = document.querySelectorAll('.person-tab');
  const shelfPrev = document.getElementById('sidebarShelfPrev');
  const shelfNext = document.getElementById('sidebarShelfNext');
  const routeToggle = document.getElementById('sidebarRouteToggle');
  const eventToggle = document.getElementById('storyVisibilityToggle');

  if (searchInput) {
    searchInput.addEventListener('input', event => {
      personSearchTerm = event.target.value || '';
      renderPeopleList();
    });
  }

  if (clearButton) {
    clearButton.addEventListener('click', () => {
      personSearchTerm = '';
      if (searchInput) searchInput.value = '';
      renderPeopleList();
      if (searchInput) searchInput.focus();
    });
  }

  if (toggleButton) {
    toggleButton.addEventListener('click', () => {
      const isCollapsed = sidebar?.classList.contains('collapsed');
      setSidebarCollapsed(!isCollapsed);
    });
  }

  shelfTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      activeSidebarTab = tab.dataset.tab || 'history';
      document.querySelectorAll('.person-tab').forEach(el => el.classList.toggle('active', el === tab));
      renderTopShelf();
    });
  });

  if (shelfPrev) {
    shelfPrev.addEventListener('click', () => {
      sidebarTabPage[activeSidebarTab] = Math.max(0, (sidebarTabPage[activeSidebarTab] || 0) - 1);
      renderTopShelf();
    });
  }

  if (shelfNext) {
    shelfNext.addEventListener('click', () => {
      sidebarTabPage[activeSidebarTab] = (sidebarTabPage[activeSidebarTab] || 0) + 1;
      renderTopShelf();
    });
  }

  if (routeToggle) {
    routeToggle.addEventListener('click', () => {
      if (!currentPersonId) return;
      if (typeof window.toggleFullRouteOverview === 'function') {
        const active = window.toggleFullRouteOverview();
        routeToggle.classList.toggle('active', !!active);
        routeToggle.setAttribute('aria-pressed', String(!!active));
      }
    });
  }


  if (eventToggle) {
    eventToggle.addEventListener('click', () => {
      if (typeof window.toggleStoryVisibility === 'function') {
        const hidden = window.toggleStoryVisibility();
        eventToggle.classList.toggle('active', !!hidden);
        eventToggle.setAttribute('aria-pressed', String(!!hidden));
        eventToggle.textContent = hidden ? 'Show events' : 'Hide events';
      }
    });
  }

  document.addEventListener('click', event => {
    const withinSidebar = event.target.closest('#person-sidebar, #person-search-dock');
    if (!withinSidebar) return;

    const tagButton = event.target.closest('[data-tag]');
    if (tagButton) {
      event.preventDefault();
      event.stopPropagation();

      const tag = tagButton.getAttribute('data-tag') || '';
      personSearchTerm = tag;
      if (searchInput) {
        searchInput.value = tag;
        searchInput.focus();
      }
      renderPeopleList();
      return;
    }

    const personButton = event.target.closest('[data-person-id]');
    if (personButton) {
      event.preventDefault();
      const personId = personButton.getAttribute('data-person-id');
      if (!personId) return;

      if (searchInput) searchInput.blur();
      personSearchTerm = '';
      if (searchInput) searchInput.value = '';
      renderPeopleList();

      if (typeof window.hideFullRouteOverview === 'function') {
        window.hideFullRouteOverview();
      }

      if (personId !== currentPersonId) {
        loadPerson(personId);
      } else {
        resetToUnselectedState();
      }

      if (window.innerWidth <= 900) {
        setSidebarCollapsed(true);
      }
    }
  });
}

function renderSearchDock() {
  const dock = document.getElementById('person-search-dock');
  if (!dock) return;

  dock.innerHTML = `
    <div class="person-search-shell slim-search-shell">
      <div class="person-search-row">
        <svg class="person-search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0a7 7 0 0114 0z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <input id="personSearchInput" class="person-search-input slim-search-input" type="text" placeholder="Search by name or tag" value="${escapeAttr(personSearchTerm)}" />
      </div>
    </div>
    <div id="personSearchResultsShell" class="person-search-results-shell is-empty floating-search-results">
      <div id="personList" class="person-list person-search-results"></div>
    </div>
  `;
}


function renderPersonSidebar() {
  const sidebar = document.getElementById('person-sidebar');
  if (!sidebar) {
    console.error('person-sidebar not found in HTML');
    return;
  }

  sidebar.innerHTML = `
    <div class="person-sidebar-shell">
      <div class="person-sidebar-top">
        <div class="person-sidebar-title-wrap">
          <div class="person-sidebar-title">People</div>
        </div>
        <button id="personSidebarToggle" class="person-sidebar-toggle" type="button" aria-expanded="true" aria-label="Hide people panel">Hide</button>
      </div>

      <div id="sidebarCurrentPerson" class="sidebar-current-person is-empty"></div>

      <div class="person-shelf">
        <div class="person-tabs">
          <button class="person-tab ${activeSidebarTab === 'people' ? 'active' : ''}" data-tab="people" type="button">People</button>
          <button class="person-tab ${activeSidebarTab === 'history' ? 'active' : ''}" data-tab="history" type="button">Viewed</button>
        </div>
        <div class="person-shelf-meta" id="sidebarShelfMeta"></div>
        <div id="sidebarShelfList" class="person-shelf-list"></div>
      </div>

      <div class="person-shelf-controls bottom-controls">
        <button id="sidebarShelfPrev" class="shelf-nav compact" type="button" aria-label="Previous page">‹</button>
        <button id="sidebarRouteToggle" class="route-nav" type="button" aria-pressed="false" ${currentPersonId ? '' : 'disabled'}>Route</button>
        <button id="sidebarShelfNext" class="shelf-nav compact" type="button" aria-label="Next page">›</button>
      </div>
    </div>
  `;

  bindSidebarEvents();
  rerenderSidebar();
  setSidebarCollapsed(window.innerWidth <= 900);
}

function getRealSteps() {
  return Array.from(document.querySelectorAll('#features .step:not(.overview-step)'));
}

function getChapterIndexFromStepElement(stepEl) {
  if (!stepEl || !window.config || !Array.isArray(window.config.chapters)) return -1;
  return window.config.chapters.findIndex(chapter => chapter.id === stepEl.id);
}

function getRealStepIndexFromChapterIndex(chapterIndex) {
  if (!Number.isFinite(chapterIndex)) return -1;
  const steps = getRealSteps();
  if (!steps.length) return -1;
  const chapter = window.config && Array.isArray(window.config.chapters)
    ? window.config.chapters[chapterIndex]
    : null;
  if (!chapter || !chapter.id) return -1;
  return steps.findIndex(step => step.id === chapter.id);
}

// Choose the chapter that wheel navigation should treat as the current anchor.
// Route mode writes a one-time resume anchor so the first wheel after exiting Route
// continues from the chapter the user actually exited to.
function getBestBaseRealStepIndex() {
  const steps = getRealSteps();
  if (!steps.length) return 0;

  const resumeChapterIndex = Number.isFinite(window.__routeResumeChapterIndex)
    ? window.__routeResumeChapterIndex
    : null;
  const hasRouteResume = window.__routeResumePending && resumeChapterIndex !== null;

  if (hasRouteResume) {
    const anchoredIndex = getRealStepIndexFromChapterIndex(resumeChapterIndex);
    if (anchoredIndex >= 0) return anchoredIndex;
  }

  const currentIndex = getRealStepIndexFromChapterIndex(currentStepIndex);
  if (currentIndex >= 0) return currentIndex;

  return getClosestRealStepIndex();
}

function clearRouteResumeAnchor() {
  window.__routeResumeChapterIndex = null;
  window.__routeResumePending = false;
}

function scrollToRealStepIndex(index) {
  const steps = getRealSteps();
  if (!steps.length) return;

  const safeIndex = Math.max(0, Math.min(index, steps.length - 1));
  const targetStep = steps[safeIndex];
  if (!targetStep) return;

  const chapterIndex = getChapterIndexFromStepElement(targetStep);
  if (chapterIndex >= 0) currentStepIndex = chapterIndex;
  targetStep.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}

function releaseBoundaryLockSoon() {
  if (boundaryLockTimer) clearTimeout(boundaryLockTimer);
  boundaryLockTimer = setTimeout(() => {
    boundaryLockDirection = null;
    boundaryLockTimer = null;
  }, 420);
}

function getClosestRealStepIndex() {
  const steps = getRealSteps();
  if (!steps.length) return 0;
  const viewportCenter = window.innerHeight * 0.5;
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  steps.forEach((step, index) => {
    const rect = step.getBoundingClientRect();
    const center = rect.top + rect.height * 0.5;
    const distance = Math.abs(center - viewportCenter);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}

// Snap wheel navigation between real event cards.
// Important: after leaving Route overview, we use the resume anchor once and then
// continue from the nearest centered chapter so normal browsing resumes cleanly.
function handleWheelSnap(event) {
  if (!snapModeEnabled || window.isSwitchingPerson || isSnapScrolling || wheelCooldown) return;

  const deltaY = event.deltaY || 0;
  if (Math.abs(deltaY) < 8) return;

  if (typeof window.isFullRouteOverviewActive === 'function' && window.isFullRouteOverviewActive()) {
    event.preventDefault();
    const direction = deltaY > 0 ? 1 : -1;
    if (typeof window.exitRouteOverviewToEvent === 'function') {
      window.exitRouteOverviewToEvent(direction);
    }
    return;
  }

  const target = event.target;
  if (target && (target.closest('input, textarea, select') || target.closest('.maplibregl-popup'))) {
    return;
  }

  const steps = getRealSteps();
  if (!steps.length) return;

  const direction = deltaY > 0 ? 1 : -1;
  const maxIndex = steps.length - 1;
  const hadRouteResume = !!window.__routeResumePending;
  const anchoredIndex = Math.max(0, Math.min(getBestBaseRealStepIndex(), maxIndex));
  const visualIndex = Math.max(0, Math.min(getClosestRealStepIndex(), maxIndex));
  const baseIndex = hadRouteResume ? anchoredIndex : visualIndex;
  const baseChapterIndex = getChapterIndexFromStepElement(steps[baseIndex]);
  if (baseChapterIndex >= 0) currentStepIndex = baseChapterIndex;

  if (boundaryLockDirection === direction) {
    event.preventDefault();
    return;
  }

  const nextIndex = Math.max(0, Math.min(baseIndex + direction, maxIndex));
  if (nextIndex === baseIndex) {
    boundaryLockDirection = direction;
    releaseBoundaryLockSoon();
    event.preventDefault();
    if (hadRouteResume) clearRouteResumeAnchor();
    return;
  }

  boundaryLockDirection = direction;
  releaseBoundaryLockSoon();
  event.preventDefault();
  isSnapScrolling = true;
  wheelCooldown = true;
  scrollToRealStepIndex(nextIndex);

  // Clear the one-shot route resume anchor as soon as the first post-route wheel
  // has been converted into a real snap target.
  if (hadRouteResume) clearRouteResumeAnchor();

  setTimeout(() => {
    const nextChapterIndex = getChapterIndexFromStepElement(steps[nextIndex]);
    if (nextChapterIndex >= 0) {
      currentStepIndex = nextChapterIndex;
    }
    isSnapScrolling = false;
    wheelCooldown = false;
  }, 420);
}

function attachWheelSnap() {
  window.removeEventListener('wheel', handleWheelSnap, { passive: false });
  window.addEventListener('wheel', handleWheelSnap, { passive: false });
}

fetch('./data/people/index.json?ts=' + Date.now())
  .then(response => response.json())
  .then(indexData => {
    peopleIndex = indexData.people;

    console.log('People index loaded:', peopleIndex);

    saveViewedPeopleHistory([]);
    renderSearchDock();
    renderPersonSidebar();
    rerenderSidebar();

    const storyDock = document.getElementById('storyVisibilityDock');
    if (storyDock) storyDock.style.display = 'none';
    bindLandingModeDismiss();
    if (typeof window.showIdleMap === 'function') {
      window.showIdleMap();
      enterLandingMode();
    }
  })
  .catch(error => {
    console.error('Failed to load people index:', error);
  });
