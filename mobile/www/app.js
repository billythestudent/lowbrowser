/**
 * LOWBROWSER MOBILE - CORE BROWSER ENGINE (app.js)
 * Standalone Mobile Webview & Multi-Tab Architecture
 */

// ==========================================
// 1. STATE & PERSISTENCE
// ==========================================

let tabs = [];
let activeTabId = null;
let tabCounter = 1;

let isAdblockEnabled = localStorage.getItem('mb_isAdblock') !== 'false';
let isDarkMode = localStorage.getItem('mb_isDarkMode') === 'true';
let isDesktopSite = false;
let searchEngine = localStorage.getItem('mb_search_engine') || 'google';
let selectedDns = localStorage.getItem('mb_dns') || 'cloudflare';
let blockedAdsCount = parseInt(localStorage.getItem('mb_blockedAdsCount') || '0');

let historyList = JSON.parse(localStorage.getItem('mb_history')) || [];
let bookmarksList = JSON.parse(localStorage.getItem('mb_bookmarks')) || [
  { title: 'Google', url: 'https://www.google.com' },
  { title: 'YouTube', url: 'https://www.youtube.com' },
  { title: 'GitHub', url: 'https://github.com' }
];

const speedDials = [
  { 
    name: 'Google', 
    url: 'https://www.google.com', 
    iconSvg: '<svg viewBox="0 0 24 24" style="color: #4285F4;"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/></svg>' 
  },
  { 
    name: 'YouTube', 
    url: 'https://www.youtube.com', 
    iconSvg: '<svg viewBox="0 0 24 24" style="color: #FF0000;"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000"/></svg>' 
  },
  { 
    name: 'Twitch', 
    url: 'https://www.twitch.tv', 
    iconSvg: '<svg viewBox="0 0 24 24" style="color: #9146FF;"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" fill="#9146FF"/></svg>' 
  },
  { 
    name: 'GitHub', 
    url: 'https://github.com', 
    iconSvg: '<svg viewBox="0 0 24 24" style="color: #FFFFFF;"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" fill="#FFFFFF"/></svg>' 
  },
  { 
    name: 'X', 
    url: 'https://twitter.com', 
    iconSvg: '<svg viewBox="0 0 24 24" style="color: #FFFFFF;"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#FFFFFF"/></svg>' 
  },
  { 
    name: 'Reddit', 
    url: 'https://reddit.com', 
    iconSvg: '<svg viewBox="0 0 24 24" style="color: #FF4500;"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.56 1.25 1.246a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.56 12 8 12.56 8 13.25c0 .688.56 1.25 1.25 1.25.688 0 1.25-.562 1.25-1.25 0-.69-.562-1.25-1.25-1.25zm5.5 0c-.688 0-1.25.56-1.25 1.25 0 .688.562 1.25 1.25 1.25.69 0 1.25-.562 1.25-1.25 0-.69-.56-1.25-1.25-1.25zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.197-2.512-.73a.326.326 0 0 0-.232-.095z" fill="#FF4500"/></svg>' 
  },
  { 
    name: 'Instagram', 
    url: 'https://instagram.com', 
    iconSvg: '<svg viewBox="0 0 24 24" style="color: #E1306C;"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" fill="#E1306C"/></svg>' 
  },
  { 
    name: 'TikTok', 
    url: 'https://tiktok.com', 
    iconSvg: '<svg viewBox="0 0 24 24" style="color: #EE1D52;"><path d="M12.525.02c1.31 0 2.6.35 3.73 1.01a7.77 7.77 0 0 0 3.86 1.09v3.66c-1.39 0-2.72-.38-3.86-1.09v8.66a7.65 7.65 0 1 1-7.65-7.65c.34 0 .68.03 1.01.07v3.74c-.33-.07-.67-.11-1.01-.11a3.91 3.91 0 1 0 3.91 3.91V.02h.01z" fill="#EE1D52"/></svg>' 
  }
];

// ==========================================
// 2. DOM ELEMENTS
// ==========================================

const addressInput = document.getElementById('mobile-address-input');
const btnClearOmnibox = document.getElementById('btn-clear-omnibox');
const btnReload = document.getElementById('btn-reload-page');
const progressBar = document.getElementById('mobile-progress-bar');
const suggestionsBox = document.getElementById('mobile-suggestions');

const startPage = document.getElementById('mobile-start-page');
const startSearchInput = document.getElementById('start-search-input');
const speedDialsContainer = document.getElementById('mobile-speed-dials');
const viewsContainer = document.getElementById('mobile-views-container');

const tabSwitcherModal = document.getElementById('tab-switcher-modal');
const tabCardsGrid = document.getElementById('tab-cards-grid');
const tabCounterBadge = document.getElementById('tab-counter-badge');

const navBtnBack = document.getElementById('nav-btn-back');
const navBtnForward = document.getElementById('nav-btn-forward');
const navBtnHome = document.getElementById('nav-btn-home');
const navBtnTabs = document.getElementById('nav-btn-tabs');
const navBtnMenu = document.getElementById('nav-btn-menu');

const menuOverlay = document.getElementById('menu-overlay');
const switchAdblock = document.getElementById('switch-adblock');
const switchDarkmode = document.getElementById('switch-darkmode');
const switchDesktop = document.getElementById('switch-desktop');

const settingsModal = document.getElementById('settings-sheet-modal');
const btnOpenSettings = document.getElementById('btn-open-settings');
const btnCloseSettingsModal = document.getElementById('btn-close-settings-modal');
const btnClearAllData = document.getElementById('btn-clear-all-data');

const listModal = document.getElementById('list-sheet-modal');
const listModalTitle = document.getElementById('list-modal-title');
const listModalContent = document.getElementById('list-modal-content');
const btnClearListModal = document.getElementById('btn-clear-list-modal');
const btnCloseListModal = document.getElementById('btn-close-list-modal');

// ==========================================
// 3. TAB MANAGEMENT ENGINE
// ==========================================

function createTab(url = 'lowbrowser://start', isPrivate = false) {
  const tabId = tabCounter++;
  
  const tabData = {
    id: tabId,
    url: url,
    title: url === 'lowbrowser://start' ? (isPrivate ? 'Gizli Sekme' : 'Yeni Sekme') : url,
    isPrivate: isPrivate,
    history: [url],
    historyIndex: 0
  };

  tabs.push(tabData);
  switchTab(tabId);
  updateTabCounterUI();
}

function switchTab(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  activeTabId = tabId;

  if (tab.url === 'lowbrowser://start') {
    startPage.classList.remove('hidden');
    addressInput.value = '';
    addressInput.placeholder = tab.isPrivate ? 'Gizli Arama yapın...' : 'Arama yapın veya adres girin...';
    btnClearOmnibox.classList.add('hidden');
    updateNavButtons();
  } else {
    navigate(tab.url);
  }

  // Close tab switcher if open
  tabSwitcherModal.classList.add('hidden');
  suggestionsBox.classList.add('hidden');
}

function closeTab(tabId) {
  const index = tabs.findIndex(t => t.id === tabId);
  if (index === -1) return;

  tabs.splice(index, 1);

  if (tabs.length === 0) {
    createTab();
  } else if (activeTabId === tabId) {
    const nextIndex = Math.min(index, tabs.length - 1);
    switchTab(tabs[nextIndex].id);
  }

  updateTabCounterUI();
  renderTabCardsGrid();
}

function updateTabCounterUI() {
  tabCounterBadge.textContent = tabs.length;
}

function renderTabCardsGrid() {
  tabCardsGrid.innerHTML = '';

  tabs.forEach(tab => {
    const card = document.createElement('div');
    card.className = tab.id === activeTabId ? 'tab-card active-card' : 'tab-card';
    
    const iconSvg = tab.isPrivate 
      ? '<svg class="icon" style="width: 14px; height: 14px; color: #f472b6;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5zm2.07-7.75l-.9.92C11.45 11.9 11 12.5 11 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z" fill="currentColor"/></svg>'
      : '<svg class="icon" style="width: 14px; height: 14px; color: #a855f7;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor"/></svg>';
    
    card.innerHTML = `
      <div class="tab-card-header">
        ${iconSvg}
        <span class="tab-card-title">${tab.title}</span>
        <button class="tab-card-close" data-id="${tab.id}">✕</button>
      </div>
      <div class="tab-card-preview">
        <svg class="icon" style="width: 32px; height: 32px; color: #334155;" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" fill="currentColor"/></svg>
      </div>
    `;

    // Select tab click
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-card-close')) return;
      switchTab(tab.id);
    });

    // Close tab click
    card.querySelector('.tab-card-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });

    tabCardsGrid.appendChild(card);
  });
}

// ==========================================
// 4. NAVIGATION & OMNIBOX ENGINE
// ==========================================

function getSearchUrl(query) {
  switch (searchEngine) {
    case 'duckduckgo':
      return 'https://duckduckgo.com/?q=' + encodeURIComponent(query);
    case 'yandex':
      return 'https://yandex.com/search/?text=' + encodeURIComponent(query);
    case 'bing':
      return 'https://www.bing.com/search?q=' + encodeURIComponent(query);
    case 'google':
    default:
      return 'https://www.google.com/search?q=' + encodeURIComponent(query);
  }
}

function navigate(url) {
  if (!url || !url.trim()) return;

  let target = url.trim();
  const isSearch = target.indexOf(' ') !== -1 || (target.indexOf('.') === -1 && !target.startsWith('localhost'));

  if (isSearch) {
    target = getSearchUrl(target);
  } else {
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }
  }

  // Save to History
  addToHistory(target, target, false);

  // Directly navigate the Android WebView (Bypasses ERR_BLOCKED_BY_RESPONSE / iframe blocks!)
  window.location.href = target;
}

function updateNavButtons() {
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab || tab.url === 'lowbrowser://start') {
    navBtnBack.disabled = true;
    navBtnForward.disabled = true;
  } else {
    navBtnBack.disabled = false;
    navBtnForward.disabled = false;
  }
}

// Address Input Events
addressInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    navigate(addressInput.value);
    addressInput.blur();
  }
});

addressInput.addEventListener('input', () => {
  const val = addressInput.value.trim();
  btnClearOmnibox.classList.toggle('hidden', val.length === 0);
  fetchMobileSuggestions(val);
});

addressInput.addEventListener('focus', () => {
  if (addressInput.value.trim().length > 0) {
    fetchMobileSuggestions(addressInput.value.trim());
  }
});

btnClearOmnibox.addEventListener('click', () => {
  addressInput.value = '';
  btnClearOmnibox.classList.add('hidden');
  suggestionsBox.classList.add('hidden');
  addressInput.focus();
});

btnReload.addEventListener('click', () => {
  window.location.reload();
});

// Start Page Search
startSearchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    navigate(startSearchInput.value);
    startSearchInput.value = '';
  }
});

// Autocomplete suggestions
async function fetchMobileSuggestions(query) {
  if (!query || query.length === 0) {
    suggestionsBox.classList.add('hidden');
    return;
  }

  try {
    const res = await fetch(`https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`);
    const data = await res.json();
    
    if (data && data[1] && data[1].length > 0) {
      suggestionsBox.innerHTML = '';
      data[1].slice(0, 6).forEach(sugg => {
        const item = document.createElement('div');
        item.className = 'mobile-sugg-item';
        item.innerHTML = `
          <svg class="icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 14z" fill="currentColor"/></svg>
          <span class="mobile-sugg-text">${sugg}</span>
        `;
        item.addEventListener('click', () => {
          navigate(sugg);
        });
        suggestionsBox.appendChild(item);
      });
      suggestionsBox.classList.remove('hidden');
    } else {
      suggestionsBox.classList.add('hidden');
    }
  } catch (err) {
    suggestionsBox.classList.add('hidden');
  }
}

// ==========================================
// 5. SPEED DIALS & SHIELD STATS
// ==========================================

function renderSpeedDials() {
  speedDialsContainer.innerHTML = '';
  speedDials.forEach(dial => {
    const item = document.createElement('div');
    item.className = 'mobile-dial-item';
    item.innerHTML = `
      <div class="mobile-dial-icon-box">${dial.iconSvg}</div>
      <span class="mobile-dial-name">${dial.name}</span>
    `;
    item.addEventListener('click', () => {
      navigate(dial.url);
    });
    speedDialsContainer.appendChild(item);
  });
}

function updateShieldStats() {
  document.getElementById('stat-ads-count').textContent = blockedAdsCount;
  document.getElementById('stat-saved-data').textContent = `${(blockedAdsCount * 0.45).toFixed(1)} MB`;
}

// ==========================================
// 6. BOTTOM NAVIGATION CONTROLS
// ==========================================

navBtnBack.addEventListener('click', () => {
  window.history.back();
});

navBtnForward.addEventListener('click', () => {
  window.history.forward();
});

navBtnHome.addEventListener('click', () => {
  window.location.href = 'index.html';
});

navBtnTabs.addEventListener('click', () => {
  renderTabCardsGrid();
  tabSwitcherModal.classList.remove('hidden');
});

document.getElementById('btn-close-tab-switcher').addEventListener('click', () => {
  tabSwitcherModal.classList.add('hidden');
});

document.getElementById('btn-new-tab-modal').addEventListener('click', () => {
  createTab('lowbrowser://start', false);
});

document.getElementById('btn-new-private-modal').addEventListener('click', () => {
  createTab('lowbrowser://start', true);
});

// ==========================================
// 7. MOBILE ACTION MENU & BOTTOM SHEET
// ==========================================

navBtnMenu.addEventListener('click', () => {
  menuOverlay.classList.remove('hidden');
});

menuOverlay.addEventListener('click', (e) => {
  if (e.target === menuOverlay) {
    menuOverlay.classList.add('hidden');
  }
});

document.getElementById('menu-btn-newtab').addEventListener('click', () => {
  menuOverlay.classList.add('hidden');
  createTab('lowbrowser://start', false);
});

document.getElementById('menu-btn-private').addEventListener('click', () => {
  menuOverlay.classList.add('hidden');
  createTab('lowbrowser://start', true);
  showToast("Yeni Gizli Sekme Açıldı");
});

document.getElementById('menu-btn-bookmarks').addEventListener('click', () => {
  menuOverlay.classList.add('hidden');
  openBookmarksModal();
});

document.getElementById('menu-btn-history').addEventListener('click', () => {
  menuOverlay.classList.add('hidden');
  openHistoryModal();
});

// Adblock Toggle
switchAdblock.checked = isAdblockEnabled;
switchAdblock.addEventListener('change', (e) => {
  isAdblockEnabled = e.target.checked;
  localStorage.setItem('mb_isAdblock', isAdblockEnabled);
  showToast(isAdblockEnabled ? "Reklam Engelleyici Açıldı" : "Reklam Engelleyici Kapatıldı");
});

// Dark Mode Toggle
switchDarkmode.checked = isDarkMode;
switchDarkmode.addEventListener('change', (e) => {
  isDarkMode = e.target.checked;
  localStorage.setItem('mb_isDarkMode', isDarkMode);
  document.body.classList.toggle('dark-web-force', isDarkMode);
  showToast(isDarkMode ? "Karanlık Mod Açıldı" : "Karanlık Mod Kapatıldı");
});

// Desktop Site Toggle
switchDesktop.addEventListener('change', (e) => {
  isDesktopSite = e.target.checked;
  showToast(isDesktopSite ? "Masaüstü Görünümüne Geçildi" : "Mobil Görünüme Geçildi");
});

// ==========================================
// 8. SETTINGS MODAL ENGINE
// ==========================================

btnOpenSettings.addEventListener('click', () => {
  menuOverlay.classList.add('hidden');
  
  // Set active radio values
  const engineRadio = document.querySelector(`input[name="mobile-search-engine"][value="${searchEngine}"]`);
  if (engineRadio) engineRadio.checked = true;

  const dnsRadio = document.querySelector(`input[name="mobile-dns"][value="${selectedDns}"]`);
  if (dnsRadio) dnsRadio.checked = true;

  settingsModal.classList.remove('hidden');
});

btnCloseSettingsModal.addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

// Search Engine Change
document.querySelectorAll('input[name="mobile-search-engine"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    searchEngine = e.target.value;
    localStorage.setItem('mb_search_engine', searchEngine);
    showToast("Arama motoru güncellendi: " + searchEngine.toUpperCase());
  });
});

// DNS Change
document.querySelectorAll('input[name="mobile-dns"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    selectedDns = e.target.value;
    localStorage.setItem('mb_dns', selectedDns);
    showToast("Güvenli DNS güncellendi: " + selectedDns.toUpperCase());
  });
});

// Clear All Data
btnClearAllData.addEventListener('click', () => {
  localStorage.removeItem('mb_history');
  localStorage.removeItem('mb_blockedAdsCount');
  historyList = [];
  blockedAdsCount = 0;
  updateShieldStats();
  showToast("Tarama verileri ve önbellek temizlendi");
});

// ==========================================
// 9. HISTORY & BOOKMARKS MODAL
// ==========================================

function addToHistory(title, url, isPrivate) {
  if (isPrivate || !url || url.startsWith('lowbrowser://')) return;
  historyList.unshift({ title: title || url, url: url, time: Date.now() });
  if (historyList.length > 100) historyList.pop();
  localStorage.setItem('mb_history', JSON.stringify(historyList));
}

function openHistoryModal() {
  listModalTitle.textContent = "Geçmiş";
  listModalContent.innerHTML = '';
  
  if (historyList.length === 0) {
    listModalContent.innerHTML = '<div style="color: var(--text-muted); text-align: center; margin-top: 40px;">Henüz tarama geçmişi bulunmuyor.</div>';
  } else {
    historyList.forEach(item => {
      const row = document.createElement('div');
      row.className = 'list-entry-item';
      row.innerHTML = `
        <span class="list-entry-title">${item.title}</span>
        <span class="list-entry-url">${item.url}</span>
      `;
      row.addEventListener('click', () => {
        listModal.classList.add('hidden');
        navigate(item.url);
      });
      listModalContent.appendChild(row);
    });
  }

  btnClearListModal.onclick = () => {
    historyList = [];
    localStorage.removeItem('mb_history');
    openHistoryModal();
    showToast("Geçmiş temizlendi");
  };

  listModal.classList.remove('hidden');
}

function openBookmarksModal() {
  listModalTitle.textContent = "Yer İmleri";
  listModalContent.innerHTML = '';

  if (bookmarksList.length === 0) {
    listModalContent.innerHTML = '<div style="color: var(--text-muted); text-align: center; margin-top: 40px;">Henüz kayıtlı yer imi yok.</div>';
  } else {
    bookmarksList.forEach(item => {
      const row = document.createElement('div');
      row.className = 'list-entry-item';
      row.innerHTML = `
        <span class="list-entry-title">${item.title}</span>
        <span class="list-entry-url">${item.url}</span>
      `;
      row.addEventListener('click', () => {
        listModal.classList.add('hidden');
        navigate(item.url);
      });
      listModalContent.appendChild(row);
    });
  }

  btnClearListModal.onclick = () => {
    bookmarksList = [];
    localStorage.removeItem('mb_bookmarks');
    openBookmarksModal();
    showToast("Yer imleri temizlendi");
  };

  listModal.classList.remove('hidden');
}

btnCloseListModal.addEventListener('click', () => {
  listModal.classList.add('hidden');
});

// Toast Helper
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('mobile-toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2200);
}

// ==========================================
// 10. INITIALIZATION
// ==========================================

renderSpeedDials();
updateShieldStats();
createTab('lowbrowser://start');
