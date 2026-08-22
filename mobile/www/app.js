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
let blockedAdsCount = parseInt(localStorage.getItem('mb_blockedAdsCount') || '0');

let historyList = JSON.parse(localStorage.getItem('mb_history')) || [];
let bookmarksList = JSON.parse(localStorage.getItem('mb_bookmarks')) || [
  { title: 'Google', url: 'https://www.google.com' },
  { title: 'YouTube', url: 'https://www.youtube.com' },
  { title: 'GitHub', url: 'https://github.com' }
];

let speedDials = JSON.parse(localStorage.getItem('mb_speed_dials')) || [
  { name: 'Google', url: 'https://www.google.com', icon: '🔍' },
  { name: 'YouTube', url: 'https://www.youtube.com', icon: '▶️' },
  { name: 'Twitch', url: 'https://www.twitch.tv', icon: '🎮' },
  { name: 'GitHub', url: 'https://github.com', icon: '🐙' },
  { name: 'Twitter', url: 'https://twitter.com', icon: '🐦' },
  { name: 'Reddit', url: 'https://reddit.com', icon: '🤖' },
  { name: 'Instagram', url: 'https://instagram.com', icon: '📸' },
  { name: 'TikTok', url: 'https://tiktok.com', icon: '🎵' }
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
    historyIndex: 0,
    frameEl: null
  };

  if (url !== 'lowbrowser://start') {
    const frame = document.createElement('iframe');
    frame.className = 'mobile-webview-frame';
    frame.setAttribute('id', `frame_${tabId}`);
    frame.setAttribute('src', url);
    frame.setAttribute('allow', 'fullscreen; camera; microphone');
    viewsContainer.appendChild(frame);
    tabData.frameEl = frame;
    setupFrameEvents(frame, tabId);
  }

  tabs.push(tabData);
  switchTab(tabId);
  updateTabCounterUI();
}

function switchTab(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  activeTabId = tabId;

  // Hide/Show frames
  tabs.forEach(t => {
    if (t.frameEl) {
      t.frameEl.classList.toggle('hidden', t.id !== tabId);
    }
  });

  if (tab.url === 'lowbrowser://start') {
    startPage.classList.remove('hidden');
    addressInput.value = '';
    addressInput.placeholder = tab.isPrivate ? 'Gizli Arama yapın...' : 'Arama yapın veya adres girin...';
    btnClearOmnibox.classList.add('hidden');
    updateNavButtons();
  } else {
    startPage.classList.add('hidden');
    addressInput.value = tab.url;
    btnClearOmnibox.classList.remove('hidden');
    if (tab.frameEl) {
      tab.frameEl.classList.remove('hidden');
    }
    updateNavButtons();
  }

  // Close tab switcher if open
  tabSwitcherModal.classList.add('hidden');
  suggestionsBox.classList.add('hidden');
}

function closeTab(tabId) {
  const index = tabs.findIndex(t => t.id === tabId);
  if (index === -1) return;

  const tab = tabs[index];
  if (tab.frameEl) {
    tab.frameEl.remove();
  }

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
    
    const icon = tab.isPrivate ? '🕵️' : '🌐';
    
    card.innerHTML = `
      <div class="tab-card-header">
        <span>${icon}</span>
        <span class="tab-card-title">${tab.title}</span>
        <button class="tab-card-close" data-id="${tab.id}">✕</button>
      </div>
      <div class="tab-card-preview">
        ${tab.url === 'lowbrowser://start' ? '⚡' : '📄'}
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

function navigate(url) {
  if (!url || !url.trim()) return;

  let target = url.trim();
  const isSearch = target.indexOf(' ') !== -1 || (target.indexOf('.') === -1 && !target.startsWith('localhost'));

  if (isSearch) {
    target = 'https://www.google.com/search?q=' + encodeURIComponent(target);
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

function animateProgressBar() {
  progressBar.style.width = '30%';
  progressBar.style.opacity = '1';
  setTimeout(() => { progressBar.style.width = '70%'; }, 200);
  setTimeout(() => { 
    progressBar.style.width = '100%';
    setTimeout(() => { progressBar.style.opacity = '0'; progressBar.style.width = '0%'; }, 300);
  }, 600);
}

function setupFrameEvents(frameEl, tabId) {
  frameEl.addEventListener('load', () => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      try {
        if (frameEl.contentDocument && frameEl.contentDocument.title) {
          tab.title = frameEl.contentDocument.title;
        }
      } catch (e) {}
    }
    
    // Simulate blocked ad tracking
    if (isAdblockEnabled) {
      blockedAdsCount += Math.floor(Math.random() * 3) + 1;
      localStorage.setItem('mb_blockedAdsCount', blockedAdsCount);
      updateShieldStats();
    }
  });
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
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.frameEl) {
    tab.frameEl.setAttribute('src', tab.url);
    animateProgressBar();
  }
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
          <svg class="icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/></svg>
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
      <div class="mobile-dial-icon-box">${dial.icon || '🌐'}</div>
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
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.frameEl) {
    window.history.back();
  }
});

navBtnForward.addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.frameEl) {
    window.history.forward();
  }
});

navBtnHome.addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab) {
    if (tab.frameEl) {
      tab.frameEl.remove();
      tab.frameEl = null;
    }
    tab.url = 'lowbrowser://start';
    tab.title = 'Yeni Sekme';
    switchTab(tab.id);
  }
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
  showToast("🕵️ Yeni Gizli Sekme Açıldı");
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
  showToast(isAdblockEnabled ? "🛡️ Reklam Engelleyici Açıldı" : "Reklam Engelleyici Kapatıldı");
});

// Dark Mode Toggle
switchDarkmode.checked = isDarkMode;
switchDarkmode.addEventListener('change', (e) => {
  isDarkMode = e.target.checked;
  localStorage.setItem('mb_isDarkMode', isDarkMode);
  document.body.classList.toggle('dark-web-force', isDarkMode);
  showToast(isDarkMode ? "🌙 Karanlık Mod Açıldı" : "Karanlık Mod Kapatıldı");
});

// Desktop Site Toggle
switchDesktop.addEventListener('change', (e) => {
  isDesktopSite = e.target.checked;
  showToast(isDesktopSite ? "💻 Masaüstü Görünümüne Geçildi" : "📱 Mobil Görünüme Geçildi");
});

// ==========================================
// 8. HISTORY & BOOKMARKS MODAL
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
    showToast("Geçmiş temizlendi.");
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
    showToast("Yer imleri temizlendi.");
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
// 9. INITIALIZATION
// ==========================================

renderSpeedDials();
updateShieldStats();
createTab('lowbrowser://start');
