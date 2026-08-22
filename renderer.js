let tabs = []; // Tab structure: { id, url, title, webviewEl, sleeping, lastActive, isPrivate }
let activeTabId = null;
let sleepMode = localStorage.getItem('sleepMode') || 'balanced';
let currentTheme = localStorage.getItem('theme') || 'purple';
let isAdBlockEnabled = localStorage.getItem('isAdBlockEnabled') !== 'false';
let searchEngine = localStorage.getItem('searchEngine') || 'google';
let isForceDarkMode = localStorage.getItem('isForceDarkMode') === 'true';

// Super Premium Variables
let loadStartTimes = {};
let blockedAdsCount = {};
let dmContrast = localStorage.getItem('dmContrast') || '100';
let dmBrightness = localStorage.getItem('dmBrightness') || '100';

// Gamer & Command Palette Variables
let memoryHistory = [];
let paletteSelectedIndex = 0;
let filteredPaletteItems = [];

const commandPalette = document.getElementById('command-palette');
const paletteInput = document.getElementById('palette-input');
const paletteResults = document.getElementById('palette-results');
const perfCanvas = document.getElementById('perf-graph');
const perfCtx = perfCanvas ? perfCanvas.getContext('2d') : null;

// Productive variables
let bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
let downloadsList = [];

const paletteCommands = [
  { name: '🚀 Belleği Temizle (RAM Turbo Boost)', cmd: '/boost', action: () => triggerBoost() },
  { name: '🌙 Zorunlu Karanlık Modu Aç/Kapat', cmd: '/dark', action: () => toggleDarkMode() },
  { name: '🕵️ Yeni Gizli Sekme Aç', cmd: '/private', action: () => createTab('lowbrowser://newtab', true) },
  { name: '➕ Yeni Normal Sekme Aç', cmd: '/newtab', action: () => createTab() },
  { name: '⚙️ Performans & Ayarlar Panelini Aç/Kapat', cmd: '/settings', action: () => toggleSettings() },
  { name: '📝 Hızlı Notlar Panelini Aç/Kapat', cmd: '/notes', action: () => document.getElementById('notes-panel').classList.toggle('hidden') },
  { name: '🌐 Aktif Sayfayı Türkçe\'ye Çevir', cmd: '/translate', action: () => translateActiveTab() }
];

// Apply saved theme class to body
if (currentTheme !== 'custom') {
  document.body.className = `theme-${currentTheme}`;
}

// Sync theme buttons active styles
const syncThemeSelector = () => {
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === currentTheme);
  });
};
syncThemeSelector();

// Sync sleep mode radio buttons
document.querySelectorAll('input[name="sleep-mode"]').forEach(radio => {
  radio.checked = radio.value === sleepMode;
  radio.addEventListener('change', (e) => {
    sleepMode = e.target.value;
    localStorage.setItem('sleepMode', sleepMode);
  });
});

// Sync search engine radio buttons
document.querySelectorAll('input[name="search-engine"]').forEach(radio => {
  radio.checked = radio.value === searchEngine;
  radio.addEventListener('change', (e) => {
    searchEngine = e.target.value;
    localStorage.setItem('searchEngine', searchEngine);
  });
});

// Theme selectors click events
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    // Clear custom theme properties
    document.documentElement.style.removeProperty('--accent-color');
    document.documentElement.style.removeProperty('--accent-hover');
    document.documentElement.style.removeProperty('--bg-primary');
    document.documentElement.style.removeProperty('--bg-secondary');
    document.documentElement.style.removeProperty('--bg-input');
    localStorage.removeItem('customThemeValues');
    localStorage.removeItem('customAccentColor');
    localStorage.removeItem('customBgColor');

    currentTheme = e.target.dataset.theme;
    document.body.className = `theme-${currentTheme}`;
    localStorage.setItem('theme', currentTheme);
    syncThemeSelector();

    if (currentTheme === 'adaptive') {
      const activeTab = tabs.find(t => t.id === activeTabId);
      if (activeTab && activeTab.faviconUrl) {
        extractAndApplyBrandColor(activeTab.faviconUrl);
      } else {
        applyAdaptiveColor('#7f00ff');
      }
    } else {
      resetAdaptiveTheme();
    }
  });
});

// ==========================================================================
// 2. WINDOW CONTROLS (Frameless UI Buttons)
// ==========================================================================

document.getElementById('btn-minimize').addEventListener('click', () => {
  window.electronAPI.minimizeWindow();
});

document.getElementById('btn-maximize').addEventListener('click', () => {
  window.electronAPI.maximizeWindow();
});

document.getElementById('btn-close').addEventListener('click', () => {
  window.electronAPI.closeWindow();
});

// Settings Overlay Panel toggle
const settingsPanel = document.getElementById('settings-panel');
document.getElementById('btn-settings').addEventListener('click', () => {
  settingsPanel.classList.toggle('open');
});
document.getElementById('btn-close-settings').addEventListener('click', () => {
  settingsPanel.classList.remove('open');
});

// ==========================================================================
// 3. TAB MANAGEMENT (Sekme Ekleme, Kapatma, Seçme)
// ==========================================================================

const tabsContainer = document.getElementById('tabs-container');
const webviewsContainer = document.getElementById('webviews-container');
const startPage = document.getElementById('start-page');
const addressInput = document.getElementById('address-input');

const createTabId = () => `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

function createTab(url = 'lowbrowser://newtab', isPrivate = false) {
  const tabId = createTabId();
  
  let webviewEl = null;
  if (url !== 'lowbrowser://newtab') {
    webviewEl = document.createElement('webview');
    webviewEl.setAttribute('id', `wv_${tabId}`);
    webviewEl.setAttribute('src', url);
    webviewEl.setAttribute('preload', window.electronAPI.preloadPath);
    if (isPrivate) {
      webviewEl.setAttribute('partition', 'private_session');
    }
    webviewsContainer.appendChild(webviewEl);
    setupWebviewEvents(webviewEl, tabId);
    
    // Focus the webview immediately
    setTimeout(() => {
      if (webviewEl) webviewEl.focus();
    }, 50);
  }

  const tabData = {
    id: tabId,
    url: url,
    title: url === 'lowbrowser://newtab' ? (isPrivate ? 'Gizli Sekme' : 'Yeni Sekme') : url,
    webviewEl: webviewEl,
    sleeping: false,
    lastActive: Date.now(),
    isPrivate: isPrivate,
    pinned: false,
    isMuted: false,
    volume: 1
  };
  
  tabs.push(tabData);

  // Tab Button Element
  const tabEl = document.createElement('div');
  tabEl.className = isPrivate ? 'tab private' : 'tab';
  tabEl.setAttribute('id', `tab_btn_${tabId}`);

  const globeIcon = '<svg class="tab-favicon icon" style="color: var(--text-dim); margin-right: 4px; width: 12px; height: 12px;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor"/></svg>';
  const privateIcon = '<svg class="tab-favicon icon" style="color: #ec4899; margin-right: 4px; width: 12px; height: 12px;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5zm2.07-7.75l-.9.92C11.45 11.9 11 12.5 11 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z" fill="currentColor"/></svg>';
  const closeIconSvg = '<svg class="icon" style="width: 8px; height: 8px;" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg>';

  tabEl.innerHTML = `
    ${isPrivate ? privateIcon : globeIcon}
    <span class="tab-title">${tabData.title}</span>
    <button class="tab-audio-btn hidden" title="Sesi Aç/Kapat">🔊</button>
    <button class="tab-close">${closeIconSvg}</button>
  `;

  // Audio button click
  const audioBtn = tabEl.querySelector('.tab-audio-btn');
  if (audioBtn) {
    audioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMuteTab(tabId);
    });
  }

  // Right-click context menu on tab
  tabEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openTabContextMenu(e.clientX, e.clientY, tabId);
  });

  // Select tab click
  tabEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-close') || e.target.classList.contains('tab-audio-btn')) return;
    switchTab(tabId);
  });

  // Close tab click
  tabEl.querySelector('.tab-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(tabId);
  });

  tabsContainer.appendChild(tabEl);
  switchTab(tabId);
}

// Closed Tabs History for Ctrl+Shift+T
let closedTabsHistory = [];

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.code === 'KeyT') {
    e.preventDefault();
    if (closedTabsHistory.length > 0) {
      const lastClosed = closedTabsHistory.pop();
      createTab(lastClosed.url, lastClosed.isPrivate);
      showToast(`↩️ Kapatılan sekme geri açıldı: ${lastClosed.title}`);
    } else {
      showToast("Geri açılacak kapatılmış sekme bulunmuyor.");
    }
  }
});

function toggleMuteTab(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;
  tab.isMuted = !tab.isMuted;
  if (tab.webviewEl) {
    tab.webviewEl.setAudioMuted(tab.isMuted);
  }
  const tabBtn = document.getElementById(`tab_btn_${tabId}`);
  if (tabBtn) {
    const audioBtn = tabBtn.querySelector('.tab-audio-btn');
    if (audioBtn) {
      audioBtn.textContent = tab.isMuted ? '🔇' : '🔊';
      audioBtn.classList.toggle('muted', tab.isMuted);
      audioBtn.classList.remove('hidden');
    }
  }
  showToast(tab.isMuted ? `🔇 "${tab.title}" sessize alındı.` : `🔊 "${tab.title}" sesi açıldı.`);
}

function togglePinTab(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;
  tab.pinned = !tab.pinned;
  const tabBtn = document.getElementById(`tab_btn_${tabId}`);
  if (tabBtn) {
    tabBtn.classList.toggle('pinned', tab.pinned);
    // Move pinned tabs to the left side
    if (tab.pinned) {
      tabsContainer.prepend(tabBtn);
      // Re-order tabs array
      const idx = tabs.findIndex(t => t.id === tabId);
      if (idx > -1) {
        const [removed] = tabs.splice(idx, 1);
        tabs.unshift(removed);
      }
    }
  }
  showToast(tab.pinned ? `📌 "${tab.title}" sabitlendi.` : `Sekme sabitlemesi kaldırıldı.`);
}

function switchTab(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  activeTabId = tabId;
  tab.lastActive = Date.now();

  // Wake up if tab is sleeping
  if (tab.sleeping) {
    wakeTab(tab);
  }

  // Update tabs style classes
  document.querySelectorAll('.tab').forEach(el => {
    el.classList.toggle('active', el.id === `tab_btn_${tabId}`);
  });

  // Hide all webviews, show active one if not newtab
  tabs.forEach(t => {
    if (t.webviewEl) {
      t.webviewEl.classList.toggle('hidden', t.id !== tabId);
    }
  });

  if (tab.url === 'lowbrowser://newtab') {
    startPage.classList.remove('hidden');
    addressInput.value = '';
    addressInput.placeholder = 'Arama yap veya URL gir...';
    document.getElementById('btn-back').disabled = true;
    document.getElementById('btn-forward').disabled = true;
    
    // Toggle start page private badge
    document.getElementById('start-private-label').classList.toggle('hidden', !tab.isPrivate);
    document.getElementById('load-speed-badge').classList.add('hidden');

    resetAdaptiveTheme();
  } else {
    startPage.classList.add('hidden');
    addressInput.value = tab.url;

    if (currentTheme === 'adaptive') {
      if (tab.faviconUrl) {
        extractAndApplyBrandColor(tab.faviconUrl);
      } else {
        applyAdaptiveColor('#7f00ff');
      }
    }

    if (tab.webviewEl) {
      tab.webviewEl.classList.remove('hidden');
      updateNavButtons(tab.webviewEl);
      
      // Auto-focus the active webview on switch
      setTimeout(() => {
        if (tab.webviewEl) tab.webviewEl.focus();
      }, 50);
    }

    // Toggle load speed badge
    const speedBadge = document.getElementById('load-speed-badge');
    if (tab.loadTime) {
      document.getElementById('load-speed-text').textContent = `${tab.loadTime}s`;
      speedBadge.classList.remove('hidden');
    } else {
      speedBadge.classList.add('hidden');
    }
    
    // Check if passwords exist for the new active tab
    checkPasswordsForCurrentTab();
  }

  const displayTitle = tab.isPrivate ? `[Private] ${tab.title}` : tab.title;
  document.title = `${displayTitle} - LowBrowser`;
}

function closeTab(tabId) {
  const index = tabs.findIndex(t => t.id === tabId);
  if (index === -1) return;

  const tab = tabs[index];
  
  // Save to closed history if not blank newtab
  if (tab.url && tab.url !== 'lowbrowser://newtab') {
    closedTabsHistory.push({ url: tab.url, title: tab.title, isPrivate: tab.isPrivate });
    if (closedTabsHistory.length > 20) {
      closedTabsHistory.shift();
    }
  }

  // Unmount Webview to clear memory
  if (tab.webviewEl) {
    tab.webviewEl.remove();
  }

  tabs.splice(index, 1);
  const tabBtn = document.getElementById(`tab_btn_${tabId}`);
  if (tabBtn) tabBtn.remove();

  if (tabs.length === 0) {
    createTab();
  } else if (activeTabId === tabId) {
    const nextIndex = Math.min(index, tabs.length - 1);
    switchTab(tabs[nextIndex].id);
  }
}

// ==========================================================================
// 4. WEBVIEW EVENTS & CONTEXT MENUS BINDINGS
// ==========================================================================

const tabContextMenu = document.getElementById('tab-context-menu');
const webviewContextMenu = document.getElementById('webview-context-menu');
let contextMenuTargetTabId = null;
let currentWebviewContextParams = null;

function openTabContextMenu(x, y, tabId) {
  contextMenuTargetTabId = tabId;
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  const pinText = document.getElementById('ctx-tab-pin-text');
  if (pinText) pinText.textContent = tab.pinned ? 'Sekme Sabitlemesini Kaldır' : 'Sekmeyi Sabitle';

  const muteText = document.getElementById('ctx-tab-mute-text');
  if (muteText) muteText.textContent = tab.isMuted ? 'Sesi Aç' : 'Sekmeyi Sustur';

  tabContextMenu.style.left = `${Math.min(x, window.innerWidth - 220)}px`;
  tabContextMenu.style.top = `${Math.min(y, window.innerHeight - 200)}px`;
  tabContextMenu.classList.remove('hidden');
  webviewContextMenu.classList.add('hidden');
}

function openWebviewContextMenu(params, tabId) {
  currentWebviewContextParams = params;
  contextMenuTargetTabId = tabId;

  // Configure link items
  const linkItem = document.getElementById('ctx-open-link-tab');
  const copyLinkItem = document.getElementById('ctx-copy-link');
  if (params.linkURL) {
    linkItem.style.display = 'flex';
    copyLinkItem.style.display = 'flex';
  } else {
    linkItem.style.display = 'none';
    copyLinkItem.style.display = 'none';
  }

  const posX = Math.min(params.x, window.innerWidth - 220);
  const posY = Math.min(params.y + 80, window.innerHeight - 240); // 80px navbar offset

  webviewContextMenu.style.left = `${posX}px`;
  webviewContextMenu.style.top = `${posY}px`;
  webviewContextMenu.classList.remove('hidden');
  tabContextMenu.classList.add('hidden');
}

// Close context menus when clicking outside
document.addEventListener('click', (e) => {
  if (!tabContextMenu.contains(e.target)) {
    tabContextMenu.classList.add('hidden');
  }
  if (!webviewContextMenu.contains(e.target)) {
    webviewContextMenu.classList.add('hidden');
  }
});

// Tab context menu actions
document.getElementById('ctx-tab-reload').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === contextMenuTargetTabId);
  if (tab && tab.webviewEl) tab.webviewEl.reload();
  tabContextMenu.classList.add('hidden');
});

document.getElementById('ctx-tab-pin').addEventListener('click', () => {
  if (contextMenuTargetTabId) togglePinTab(contextMenuTargetTabId);
  tabContextMenu.classList.add('hidden');
});

document.getElementById('ctx-tab-mute').addEventListener('click', () => {
  if (contextMenuTargetTabId) toggleMuteTab(contextMenuTargetTabId);
  tabContextMenu.classList.add('hidden');
});

document.getElementById('ctx-tab-duplicate').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === contextMenuTargetTabId);
  if (tab) createTab(tab.url, tab.isPrivate);
  tabContextMenu.classList.add('hidden');
});

document.getElementById('ctx-tab-close').addEventListener('click', () => {
  if (contextMenuTargetTabId) closeTab(contextMenuTargetTabId);
  tabContextMenu.classList.add('hidden');
});

// Webview context menu actions
document.getElementById('ctx-nav-back').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.webviewEl && tab.webviewEl.canGoBack()) tab.webviewEl.goBack();
  webviewContextMenu.classList.add('hidden');
});

document.getElementById('ctx-nav-forward').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.webviewEl && tab.webviewEl.canGoForward()) tab.webviewEl.goForward();
  webviewContextMenu.classList.add('hidden');
});

document.getElementById('ctx-nav-reload').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.webviewEl) tab.webviewEl.reload();
  webviewContextMenu.classList.add('hidden');
});

document.getElementById('ctx-open-link-tab').addEventListener('click', () => {
  if (currentWebviewContextParams && currentWebviewContextParams.linkURL) {
    createTab(currentWebviewContextParams.linkURL);
  }
  webviewContextMenu.classList.add('hidden');
});

document.getElementById('ctx-copy-link').addEventListener('click', () => {
  if (currentWebviewContextParams && currentWebviewContextParams.linkURL) {
    window.electronAPI.writeClipboard(currentWebviewContextParams.linkURL);
    showToast("Bağlantı panoya kopyalandı!");
  }
  webviewContextMenu.classList.add('hidden');
});

document.getElementById('ctx-view-source').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.url && !tab.url.startsWith('lowbrowser://')) {
    createTab(`view-source:${tab.url}`);
  }
  webviewContextMenu.classList.add('hidden');
});

document.getElementById('ctx-inspect-element').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.webviewEl) {
    tab.webviewEl.openDevTools();
  }
  webviewContextMenu.classList.add('hidden');
});

function setupWebviewEvents(webviewEl, tabId) {
  webviewEl.addEventListener('did-start-loading', () => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab && !tab.sleeping) {
      updateTabButtonText(tabId, 'Yükleniyor...');
    }
    loadStartTimes[tabId] = Date.now();
    if (tabId === activeTabId) {
      document.getElementById('load-speed-badge').classList.add('hidden');
    }
  });

  // Media audio events
  webviewEl.addEventListener('media-started-playing', () => {
    const tabBtn = document.getElementById(`tab_btn_${tabId}`);
    if (tabBtn) {
      const audioBtn = tabBtn.querySelector('.tab-audio-btn');
      if (audioBtn) audioBtn.classList.remove('hidden');
    }
  });

  webviewEl.addEventListener('media-paused', () => {
    setTimeout(() => {
      const tabBtn = document.getElementById(`tab_btn_${tabId}`);
      if (tabBtn && (!webviewEl.isCurrentlyAudible || !webviewEl.isCurrentlyAudible())) {
        const audioBtn = tabBtn.querySelector('.tab-audio-btn');
        if (audioBtn) audioBtn.classList.add('hidden');
      }
    }, 1500);
  });

  // Native context-menu event inside webview
  webviewEl.addEventListener('context-menu', (e) => {
    e.preventDefault();
    openWebviewContextMenu(e.params, tabId);
  });

  webviewEl.addEventListener('did-stop-loading', () => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab && !tab.sleeping) {
      updateTabButtonText(tabId, tab.title);
      if (tabId === activeTabId) {
        updateNavButtons(webviewEl);
      }
      
      // Inject volume settings on page load
      if (tab.volume !== undefined) {
        webviewEl.executeJavaScript(`
          document.querySelectorAll('video, audio').forEach(el => {
            el.volume = ${tab.volume};
          });
        `).catch(() => {});
      }
    }

    // Calculate load speed
    const start = loadStartTimes[tabId];
    if (start) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      if (tab) {
        tab.loadTime = elapsed;
        if (tabId === activeTabId) {
          document.getElementById('load-speed-text').textContent = `${elapsed}s`;
          document.getElementById('load-speed-badge').classList.remove('hidden');
        }
      }
      delete loadStartTimes[tabId];
    }

    applyForceDarkModeToWebview(webviewEl);
    updateTabAudioStatus(tabId);
  });

  webviewEl.addEventListener('media-status-change', () => {
    updateTabAudioStatus(tabId);
  });

  webviewEl.addEventListener('page-title-updated', (e) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      tab.title = e.title;
      updateTabButtonText(tabId, e.title);
      if (tabId === activeTabId) {
        document.title = `${e.title} - LowBrowser`;
      }
    }
  });

  webviewEl.addEventListener('did-navigate', (e) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      tab.url = e.url;
      if (tabId === activeTabId) {
        addressInput.value = e.url;
      }
      addToHistory(tab.title, e.url, tab.isPrivate);
      if (tabId === activeTabId) {
        checkPasswordsForCurrentTab();
      }
    }
    applyForceDarkModeToWebview(webviewEl);
  });

  webviewEl.addEventListener('did-navigate-in-page', (e) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      tab.url = e.url;
      if (tabId === activeTabId) {
        addressInput.value = e.url;
      }
      addToHistory(tab.title, e.url, tab.isPrivate);
      if (tabId === activeTabId) {
        checkPasswordsForCurrentTab();
      }
    }
  });

  // Handle Target="_blank" new window events
  webviewEl.addEventListener('new-window', (e) => {
    const tab = tabs.find(t => t.id === tabId);
    createTab(e.url, tab ? tab.isPrivate : false);
  });

  // Handle favicon updates
  webviewEl.addEventListener('page-favicon-updated', (e) => {
    const favicons = e.favicons;
    if (favicons && favicons.length > 0) {
      const tab = tabs.find(t => t.id === tabId);
      if (tab) {
        tab.faviconUrl = favicons[0];
      }

      const tabEl = document.getElementById(`tab_btn_${tabId}`);
      if (tabEl) {
        const oldFav = tabEl.querySelector('.tab-favicon');
        if (oldFav) {
          const newFav = document.createElement('img');
          newFav.className = 'tab-favicon';
          newFav.src = favicons[0];
          newFav.style.width = '14px';
          newFav.style.height = '14px';
          newFav.style.marginRight = '4px';
          newFav.style.borderRadius = '3px';
          newFav.style.objectFit = 'contain';
          oldFav.replaceWith(newFav);
        } else {
          const imgFav = tabEl.querySelector('img.tab-favicon');
          if (imgFav) {
            imgFav.src = favicons[0];
          }
        }
      }

      if (tabId === activeTabId && currentTheme === 'adaptive') {
        extractAndApplyBrandColor(favicons[0]);
      }
    }
  });
}

function updateTabButtonText(tabId, text) {
  const btn = document.getElementById(`tab_btn_${tabId}`);
  if (btn) {
    btn.querySelector('.tab-title').textContent = text;
  }
}

function updateNavButtons(webviewEl) {
  try {
    document.getElementById('btn-back').disabled = !webviewEl.canGoBack();
    document.getElementById('btn-forward').disabled = !webviewEl.canGoForward();
  } catch (err) {
    // Webview might not be fully ready
  }
}

// ==========================================================================
// 5. NAVIGATION CONTROLS & URL DETECTION
// ==========================================================================

function navigate(url) {
  if (!url.trim()) return;

  let targetUrl = url.trim();
  const isSearch = targetUrl.indexOf(' ') !== -1 || (targetUrl.indexOf('.') === -1 && !targetUrl.startsWith('localhost'));

  if (isSearch) {
    if (searchEngine === 'duckduckgo') {
      targetUrl = 'https://duckduckgo.com/?q=' + encodeURIComponent(targetUrl);
    } else if (searchEngine === 'yandex') {
      targetUrl = 'https://yandex.com/search/?text=' + encodeURIComponent(targetUrl);
    } else {
      targetUrl = 'https://www.google.com/search?q=' + encodeURIComponent(targetUrl);
    }
  } else {
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }
  }

  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;

  tab.url = targetUrl;
  tab.lastActive = Date.now();

  if (tab.sleeping) {
    wakeTab(tab);
  }

  // If currently on newtab HTML start page, replace with <webview> tag
  if (!tab.webviewEl) {
    const webviewEl = document.createElement('webview');
    webviewEl.setAttribute('id', `wv_${tab.id}`);
    webviewEl.setAttribute('src', targetUrl);
    webviewEl.setAttribute('preload', window.electronAPI.preloadPath);
    if (tab.isPrivate) {
      webviewEl.setAttribute('partition', 'private_session');
    }
    webviewsContainer.appendChild(webviewEl);
    setupWebviewEvents(webviewEl, tab.id);
    tab.webviewEl = webviewEl;
    
    startPage.classList.add('hidden');
    webviewEl.classList.remove('hidden');
  } else {
    tab.webviewEl.loadURL(targetUrl);
  }
}

addressInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    navigate(addressInput.value);
    addressInput.blur();
    
    // Pass focus to the webview
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab && activeTab.webviewEl) {
      setTimeout(() => {
        if (activeTab.webviewEl) activeTab.webviewEl.focus();
      }, 50);
    }
  }
});

document.getElementById('btn-back').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.webviewEl && !tab.sleeping) {
    tab.webviewEl.goBack();
  }
});

document.getElementById('btn-forward').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.webviewEl && !tab.sleeping) {
    tab.webviewEl.goForward();
  }
});

document.getElementById('btn-reload').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab) {
    if (tab.sleeping) {
      wakeTab(tab);
    } else if (tab.webviewEl) {
      tab.webviewEl.reload();
    }
  }
});

document.getElementById('btn-home').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab) {
    // Unmount webview if it exists to clean memory
    if (tab.webviewEl) {
      tab.webviewEl.remove();
      tab.webviewEl = null;
    }
    tab.url = 'lowbrowser://newtab';
    tab.title = 'Yeni Sekme';
    tab.sleeping = false;
    updateTabButtonText(tab.id, 'Yeni Sekme');
    switchTab(tab.id);
  }
});

// Speed dials click mapping
document.querySelectorAll('.dial-card').forEach(card => {
  card.addEventListener('click', (e) => {
    navigate(e.target.dataset.url);
  });
});

// Start page search input triggers
document.getElementById('btn-start-search').addEventListener('click', () => {
  navigate(document.getElementById('start-search-input').value);
  focusActiveWebview();
});
document.getElementById('start-search-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    navigate(e.target.value);
    focusActiveWebview();
  }
});

function focusActiveWebview() {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && activeTab.webviewEl) {
    setTimeout(() => {
      if (activeTab.webviewEl) activeTab.webviewEl.focus();
    }, 80);
  }
}

// ==========================================================================
// 6. RAM & PERFORMANCE ENGINE (TAB SLEEPING / UNMOUNTING)
// ==========================================================================

function checkSleepingTabs() {
  if (sleepMode === 'never') return;

  const threshold = sleepMode === 'aggressive' ? 30000 : 120000; // 30s or 2m
  const now = Date.now();

  tabs.forEach(tab => {
    // Sleep criteria:
    // 1. Not active tab
    // 2. Not already sleeping
    // 3. Not a native newtab
    // 4. Has a mounted webview
    // 5. Exceeded inactivity threshold
    if (tab.id !== activeTabId &&
        !tab.sleeping &&
        tab.url !== 'lowbrowser://newtab' &&
        tab.webviewEl) {

      // Exemption: If tab is currently playing audio (YouTube Music etc), do not sleep!
      let isAudible = false;
      try {
        isAudible = tab.webviewEl.isCurrentlyAudible();
      } catch (err) {}

      if (isAudible) {
        tab.lastActive = now; // reset timer
        return;
      }

      if (now - tab.lastActive > threshold) {
        putTabToSleep(tab);
      }
    }
  });
}

function putTabToSleep(tab) {
  if (!tab.webviewEl) return;

  // Unmount Webview completely to free all memory
  tab.webviewEl.remove();
  tab.webviewEl = null;

  tab.sleeping = true;
  updateTabButtonText(tab.id, `${tab.title} (Boşta)`);
  console.log(`[Electron Sleep] sekme '${tab.title}' unmount edildi (RAM temizlendi).`);
}

function wakeTab(tab) {
  if (!tab.sleeping) return;

  console.log(`[Electron Sleep] sekme '${tab.title}' uyandırılıyor, webview yeniden oluşturuluyor...`);
  
  const webviewEl = document.createElement('webview');
  webviewEl.setAttribute('id', `wv_${tab.id}`);
  webviewEl.setAttribute('src', tab.url);
  webviewEl.setAttribute('preload', window.electronAPI.preloadPath);
  if (tab.isPrivate) {
    webviewEl.setAttribute('partition', 'private_session');
  }
  webviewsContainer.appendChild(webviewEl);
  setupWebviewEvents(webviewEl, tab.id);

  tab.webviewEl = webviewEl;
  tab.sleeping = false;
  tab.lastActive = Date.now();
  updateTabButtonText(tab.id, tab.title);
}

// GAMER MODU: Window switches / Focus loss triggers (Valorant is active)
window.addEventListener('blur', () => {
  // Switched to Valorant/Other app: Sleep background tabs that are not currently playing audio!
  tabs.forEach(tab => {
    if (tab.id !== activeTabId && !tab.sleeping && tab.url !== 'lowbrowser://newtab' && tab.webviewEl) {
      let isAudible = false;
      try {
        isAudible = tab.webviewEl.isCurrentlyAudible();
      } catch (err) {}

      if (!isAudible) {
        putTabToSleep(tab);
      }
    }
  });
  console.log('[Gamer Modu] Odağı kaybetti. Ses çalanlar hariç tüm sekmeler unmount edildi (RAM boşaltıldı).');
});

window.addEventListener('focus', () => {
  // Switched back to browser: Wake up the active tab instantly
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && activeTab.sleeping) {
    wakeTab(activeTab);
    switchTab(activeTabId);
  }
});

// Running tab sleeping checking routine every 10 seconds
setInterval(checkSleepingTabs, 10000);

// ==========================================================================
// 7. PERFORMANCE MONITORING (Stats updates)
// ==========================================================================

async function updatePerformanceStats() {
  let ramMB = 0;
  let cpu = 0;
  try {
    const stats = await window.electronAPI.getStats();
    if (stats) {
      ramMB = stats.memoryMB;
      cpu = stats.cpuPercent;
    }
  } catch (err) {}

  if (ramMB > 0) {
    memoryHistory.push(ramMB);
    if (memoryHistory.length > 15) memoryHistory.shift();
  }

  if (!settingsPanel.classList.contains('open')) return;

  if (ramMB > 0) {
    document.getElementById('ram-usage-text').textContent = `Tarayıcı RAM Kullanımı: ${ramMB} MB`;
    document.getElementById('ram-progress').style.width = `${Math.min(100, (ramMB / 800) * 100)}%`;

    document.getElementById('cpu-usage-text').textContent = `Tarayıcı CPU Kullanımı: ${cpu}%`;
    document.getElementById('cpu-progress').style.width = `${cpu}%`;
    
    drawPerformanceGraph();
  }
}

// Update performance stats every 2 seconds
setInterval(updatePerformanceStats, 2000);

// ==========================================================================
// 8. APP INITIALIZATION & NEW SHORTCUT CONTROLS
// ==========================================================================

document.getElementById('btn-new-tab').addEventListener('click', () => {
  createTab();
});

document.getElementById('btn-new-private-tab').addEventListener('click', () => {
  createTab('lowbrowser://newtab', true);
});

// AdBlocker Switch Controller
const adBlockBtn = document.getElementById('btn-adblock');
function updateAdBlockUI() {
  if (isAdBlockEnabled) {
    adBlockBtn.className = 'nav-btn shield-active';
    adBlockBtn.title = 'Reklam Engelleyici: Aktif';
  } else {
    adBlockBtn.className = 'nav-btn shield-inactive';
    adBlockBtn.title = 'Reklam Engelleyici: Pasif (Reklamlara izin veriliyor)';
  }
  window.electronAPI.toggleAdBlock(isAdBlockEnabled);
}
updateAdBlockUI(); // Initial check

adBlockBtn.addEventListener('click', () => {
  isAdBlockEnabled = !isAdBlockEnabled;
  localStorage.setItem('isAdBlockEnabled', isAdBlockEnabled);
  updateAdBlockUI();
});

// Force Dark Mode Switch Controller
const darkModeBtn = document.getElementById('tool-btn-darkmode');
function updateDarkModeUI() {
  if (isForceDarkMode) {
    darkModeBtn.classList.add('active');
    darkModeBtn.title = 'Zorunlu Karanlık Mod: Aktif';
  } else {
    darkModeBtn.classList.remove('active');
    darkModeBtn.title = 'Zorunlu Karanlık Mod: Pasif';
  }
}
updateDarkModeUI(); // Initial check

darkModeBtn.addEventListener('click', () => {
  isForceDarkMode = !isForceDarkMode;
  localStorage.setItem('isForceDarkMode', isForceDarkMode);
  updateDarkModeUI();
  
  // Apply immediately to the active tab if it exists
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && activeTab.webviewEl && !activeTab.sleeping) {
    applyForceDarkModeToWebview(activeTab.webviewEl);
  }
});

function applyForceDarkModeToWebview(webview) {
  if (!webview) return;
  const darkCode = `
    (() => {
      let style = document.getElementById('lowbrowser-force-dark');
      const enabled = ${isForceDarkMode};
      if (enabled) {
        if (!style) {
          style = document.createElement('style');
          style.id = 'lowbrowser-force-dark';
          document.documentElement.appendChild(style);
        }
        style.innerHTML = 'html { filter: invert(1) hue-rotate(180deg) contrast(${dmContrast}%) brightness(${dmBrightness}%) !important; } img, video, iframe, canvas { filter: invert(1) hue-rotate(180deg) contrast(${100 / (dmContrast / 100)}%) brightness(${100 / (dmBrightness / 100)}%) !important; }';
      } else {
        if (style) style.remove();
      }
    })();
  `;
  try {
    webview.executeJavaScript(darkCode).catch(() => {});
  } catch (err) {}
}

// Toast Notifications Engine
function showToast(message) {
  let toast = document.getElementById('toast-container');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-container';
    toast.innerHTML = `<span id="toast-text"></span>`;
    document.body.appendChild(toast);
  }
  toast.querySelector('#toast-text').textContent = message;
  toast.classList.add('show');
  
  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// RAM Turbo Boost GC Trigger
document.getElementById('tool-btn-boost').addEventListener('click', async () => {
  const boostBtn = document.getElementById('tool-btn-boost');
  boostBtn.style.transform = 'scale(0.85) rotate(15deg)';
  setTimeout(() => { boostBtn.style.transform = ''; }, 200);

  try {
    const beforeStats = await window.electronAPI.getStats();
    const ramBefore = beforeStats ? beforeStats.memoryMB : 0;
    
    // Call Garbage Collection
    window.electronAPI.triggerGC();
    
    setTimeout(async () => {
      const afterStats = await window.electronAPI.getStats();
      const ramAfter = afterStats ? afterStats.memoryMB : 0;
      const freedMB = ramBefore - ramAfter;
      
      if (freedMB > 0) {
        showToast(`RAM Turbo Boost Aktif! ${freedMB} MB bellek serbest bırakıldı.`);
      } else {
        showToast(`RAM Turbo Boost Aktif! Bellek zaten optimum seviyede.`);
      }
    }, 400);
  } catch (err) {
    showToast(`Bellek temizlendi!`);
  }
});

// Security Shield Popover Controller
const shieldBtn = document.getElementById('btn-security-shield');
const shieldPopover = document.getElementById('shield-popover');

shieldBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab) {
    updateShieldPopoverUI(activeTab);
  }
  shieldPopover.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!shieldPopover.contains(e.target) && e.target !== shieldBtn) {
    shieldPopover.classList.add('hidden');
  }
});

function updateShieldPopoverUI(tab) {
  const sslStatus = document.getElementById('shield-ssl-status');
  const adsBlockedText = document.getElementById('shield-ads-blocked');
  
  if (tab.url.startsWith('https://')) {
    sslStatus.innerHTML = '<span style="color: #10b981;">● Güvenli Bağlantı (HTTPS)</span>';
  } else if (tab.url.startsWith('http://')) {
    sslStatus.innerHTML = '<span style="color: #ef4444;">● Güvenli Olmayan Bağlantı (HTTP)</span>';
  } else {
    sslStatus.innerHTML = '<span style="color: var(--text-dim);">Yerel Sayfa (Internal)</span>';
  }
  
  const count = blockedAdsCount[tab.id] || 0;
  adsBlockedText.textContent = `Bu sitede ${count} reklam engellendi.`;
}

// Track blocked ads from IPC events
window.electronAPI.onAdBlocked(() => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab) {
    const currentCount = blockedAdsCount[activeTab.id] || 0;
    blockedAdsCount[activeTab.id] = currentCount + 1;
    
    // Update active popover UI
    updateShieldPopoverUI(activeTab);
  }
});

// Injected Dark Mode Contrast / Brightness Sliders
const sliderContrast = document.getElementById('slider-contrast');
const sliderBrightness = document.getElementById('slider-brightness');
const labelContrast = document.getElementById('label-contrast');
const labelBrightness = document.getElementById('label-brightness');

sliderContrast.value = dmContrast;
labelContrast.textContent = `${dmContrast}%`;
sliderBrightness.value = dmBrightness;
labelBrightness.textContent = `${dmBrightness}%`;

const updateContrast = () => {
  dmContrast = sliderContrast.value;
  labelContrast.textContent = `${dmContrast}%`;
  localStorage.setItem('dmContrast', dmContrast);
  applyContrastToActiveTab();
};

const updateBrightness = () => {
  dmBrightness = sliderBrightness.value;
  labelBrightness.textContent = `${dmBrightness}%`;
  localStorage.setItem('dmBrightness', dmBrightness);
  applyContrastToActiveTab();
};

sliderContrast.addEventListener('input', updateContrast);
sliderBrightness.addEventListener('input', updateBrightness);

function applyContrastToActiveTab() {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && activeTab.webviewEl && !activeTab.sleeping) {
    applyForceDarkModeToWebview(activeTab.webviewEl);
  }
}

// --- THEME STUDIO & SETTINGS CONTROLLER ---
const studioNavBtns = document.querySelectorAll('.studio-nav-btn');
const studioTabContents = document.querySelectorAll('.studio-tab-content');

studioNavBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    studioNavBtns.forEach(b => b.classList.remove('active'));
    studioTabContents.forEach(c => c.classList.remove('active'));
    
    btn.classList.add('active');
    const targetEl = document.getElementById(targetId);
    if (targetEl) targetEl.classList.add('active');
  });
});

// ESC key closes Settings Studio
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && settingsPanel && settingsPanel.classList.contains('open')) {
    settingsPanel.classList.remove('open');
  }
});

// Color Pickers & Live Preview
const pickerAccent = document.getElementById('picker-accent');
const pickerBgPrimary = document.getElementById('picker-bg-primary');
const pickerBgSecondary = document.getElementById('picker-bg-secondary');
const pickerBgInput = document.getElementById('picker-bg-input');

const hexAccent = document.getElementById('hex-accent');
const hexBgPrimary = document.getElementById('hex-bg-primary');
const hexBgSecondary = document.getElementById('hex-bg-secondary');
const hexBgInput = document.getElementById('hex-bg-input');

const mockBrowser = document.getElementById('mock-browser-window');
const mockTitlebar = document.getElementById('mock-titlebar');
const mockNavbar = document.getElementById('mock-navbar');
const mockAddressBar = document.getElementById('mock-address-bar');
const mockTabActive = document.getElementById('mock-tab');
const mockActionBtn = document.getElementById('mock-action-btn');
const mockLogo = document.getElementById('mock-logo');
const mockAccentPill = document.getElementById('mock-accent-pill');
const mockPageBody = document.getElementById('mock-page-body');

function updateStudioLivePreview() {
  const accent = pickerAccent ? pickerAccent.value : '#7f00ff';
  const bgPrimary = pickerBgPrimary ? pickerBgPrimary.value : '#07080a';
  const bgSecondary = pickerBgSecondary ? pickerBgSecondary.value : '#0c0d12';
  const bgInput = pickerBgInput ? pickerBgInput.value : '#151720';

  if (hexAccent) hexAccent.textContent = accent;
  if (hexBgPrimary) hexBgPrimary.textContent = bgPrimary;
  if (hexBgSecondary) hexBgSecondary.textContent = bgSecondary;
  if (hexBgInput) hexBgInput.textContent = bgInput;

  if (mockTitlebar) mockTitlebar.style.backgroundColor = bgPrimary;
  if (mockNavbar) mockNavbar.style.backgroundColor = bgSecondary;
  if (mockAddressBar) mockAddressBar.style.backgroundColor = bgInput;
  if (mockTabActive) {
    mockTabActive.style.borderBottomColor = accent;
    mockTabActive.style.color = 'white';
  }
  if (mockActionBtn) mockActionBtn.style.backgroundColor = accent;
  if (mockLogo) mockLogo.style.color = accent;
  if (mockAccentPill) mockAccentPill.style.backgroundColor = accent;
  if (mockPageBody) mockPageBody.style.backgroundColor = bgPrimary;
}

[pickerAccent, pickerBgPrimary, pickerBgSecondary, pickerBgInput].forEach(picker => {
  if (picker) {
    picker.addEventListener('input', updateStudioLivePreview);
  }
});

// Apply Custom Theme Live
function applyCustomThemeValues(accent, bgPrimary, bgSecondary, bgInput) {
  document.documentElement.style.setProperty('--accent-color', accent);
  document.documentElement.style.setProperty('--accent-hover', accent);
  document.documentElement.style.setProperty('--bg-primary', bgPrimary);
  document.documentElement.style.setProperty('--bg-secondary', bgSecondary);
  document.documentElement.style.setProperty('--bg-input', bgInput);

  document.body.className = '';
  localStorage.setItem('theme', 'custom');
  localStorage.setItem('customThemeValues', JSON.stringify({ accent, bgPrimary, bgSecondary, bgInput }));
  syncThemeSelector();
}

const btnApplyCustomTheme = document.getElementById('btn-apply-custom-theme');
if (btnApplyCustomTheme) {
  btnApplyCustomTheme.addEventListener('click', () => {
    const accent = pickerAccent.value;
    const bgPrimary = pickerBgPrimary.value;
    const bgSecondary = pickerBgSecondary.value;
    const bgInput = pickerBgInput.value;

    applyCustomThemeValues(accent, bgPrimary, bgSecondary, bgInput);
    showToast("✨ Özel temanız canlı olarak tarayıcıya uygulandı!");
  });
}

// Saved Themes Library logic
let savedCustomThemes = JSON.parse(localStorage.getItem('lowbrowser_saved_custom_themes')) || [];

const savedThemesList = document.getElementById('saved-custom-themes-list');
const inputCustomThemeName = document.getElementById('input-custom-theme-name');
const btnSaveCustomTheme = document.getElementById('btn-save-custom-theme');

function renderSavedThemesUI() {
  if (!savedThemesList) return;
  savedThemesList.innerHTML = '';

  if (savedCustomThemes.length === 0) {
    savedThemesList.innerHTML = '<div class="empty-themes-msg">Henüz kaydedilmiş özel bir temanız bulunmuyor.</div>';
    return;
  }

  savedCustomThemes.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'saved-theme-item';

    card.innerHTML = `
      <div class="saved-theme-header">
        <span class="saved-theme-name">${item.name}</span>
        <button class="btn-delete-saved-theme" title="Temayı Sil">✕</button>
      </div>
      <div class="saved-theme-swatches">
        <div class="theme-swatch" style="background-color: ${item.accent};" title="Vurgu"></div>
        <div class="theme-swatch" style="background-color: ${item.bgPrimary};" title="Ana Arka Plan"></div>
        <div class="theme-swatch" style="background-color: ${item.bgSecondary};" title="Panel"></div>
        <div class="theme-swatch" style="background-color: ${item.bgInput};" title="Adres Çubuğu"></div>
      </div>
      <button class="btn-apply-saved-theme">Temayı Uygula</button>
    `;

    // Apply button
    card.querySelector('.btn-apply-saved-theme').addEventListener('click', () => {
      applyCustomThemeValues(item.accent, item.bgPrimary, item.bgSecondary, item.bgInput);
      if (pickerAccent) pickerAccent.value = item.accent;
      if (pickerBgPrimary) pickerBgPrimary.value = item.bgPrimary;
      if (pickerBgSecondary) pickerBgSecondary.value = item.bgSecondary;
      if (pickerBgInput) pickerBgInput.value = item.bgInput;
      updateStudioLivePreview();
      showToast(`🎨 "${item.name}" teması başarıyla uygulandı.`);
    });

    // Delete button
    card.querySelector('.btn-delete-saved-theme').addEventListener('click', (e) => {
      e.stopPropagation();
      savedCustomThemes.splice(index, 1);
      localStorage.setItem('lowbrowser_saved_custom_themes', JSON.stringify(savedCustomThemes));
      renderSavedThemesUI();
      showToast("Özel tema silindi.");
    });

    savedThemesList.appendChild(card);
  });
}

if (btnSaveCustomTheme) {
  btnSaveCustomTheme.addEventListener('click', () => {
    const name = inputCustomThemeName ? inputCustomThemeName.value.trim() : '';
    if (!name) {
      showToast("Lütfen temanız için bir isim girin!");
      if (inputCustomThemeName) inputCustomThemeName.focus();
      return;
    }

    const accent = pickerAccent.value;
    const bgPrimary = pickerBgPrimary.value;
    const bgSecondary = pickerBgSecondary.value;
    const bgInput = pickerBgInput.value;

    savedCustomThemes.push({ id: Date.now(), name, accent, bgPrimary, bgSecondary, bgInput });
    localStorage.setItem('lowbrowser_saved_custom_themes', JSON.stringify(savedCustomThemes));

    applyCustomThemeValues(accent, bgPrimary, bgSecondary, bgInput);
    renderSavedThemesUI();
    if (inputCustomThemeName) inputCustomThemeName.value = '';
    showToast(`🎉 "${name}" teması kaydedildi ve uygulandı!`);
  });
}

// Initialise saved custom theme if active
const savedThemeValues = JSON.parse(localStorage.getItem('customThemeValues'));
if (currentTheme === 'custom' && savedThemeValues) {
  applyCustomThemeValues(
    savedThemeValues.accent,
    savedThemeValues.bgPrimary,
    savedThemeValues.bgSecondary,
    savedThemeValues.bgInput
  );
  if (pickerAccent) pickerAccent.value = savedThemeValues.accent;
  if (pickerBgPrimary) pickerBgPrimary.value = savedThemeValues.bgPrimary;
  if (pickerBgSecondary) pickerBgSecondary.value = savedThemeValues.bgSecondary;
  if (pickerBgInput) pickerBgInput.value = savedThemeValues.bgInput;
}
updateStudioLivePreview();
renderSavedThemesUI();

// ==========================================================================
// 9. GAMER & POWER USER COMPONENT LOGIC
// ==========================================================================

// Toggle Settings Helper
function toggleSettings() {
  settingsPanel.classList.toggle('open');
}

// Toggle Dark Mode Helper
function toggleDarkMode() {
  isForceDarkMode = !isForceDarkMode;
  localStorage.setItem('isForceDarkMode', isForceDarkMode);
  updateDarkModeUI();
  
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && activeTab.webviewEl && !activeTab.sleeping) {
    applyForceDarkModeToWebview(activeTab.webviewEl);
  }
}

// Trigger Boost Helper
function triggerBoost() {
  const boostBtn = document.getElementById('tool-btn-boost');
  boostBtn.click();
}

// Command Palette toggling
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey && e.code === 'Space') || (e.ctrlKey && e.code === 'KeyP')) {
    e.preventDefault();
    toggleCommandPalette();
  }
});

function toggleCommandPalette() {
  commandPalette.classList.toggle('hidden');
  if (!commandPalette.classList.contains('hidden')) {
    paletteInput.value = '';
    paletteInput.focus();
    renderPaletteResults();
  }
}

paletteInput.addEventListener('input', renderPaletteResults);

paletteInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    paletteSelectedIndex = (paletteSelectedIndex + 1) % filteredPaletteItems.length;
    updatePaletteSelection();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    paletteSelectedIndex = (paletteSelectedIndex - 1 + filteredPaletteItems.length) % filteredPaletteItems.length;
    updatePaletteSelection();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const selectedItem = filteredPaletteItems[paletteSelectedIndex];
    if (selectedItem) {
      executePaletteItem(selectedItem);
    }
  } else if (e.key === 'Escape') {
    commandPalette.classList.add('hidden');
  }
});

function renderPaletteResults() {
  const query = paletteInput.value.toLowerCase().trim();
  paletteSelectedIndex = 0;
  filteredPaletteItems = [];

  // Commands matching query
  paletteCommands.forEach(cmd => {
    if (cmd.name.toLowerCase().includes(query) || cmd.cmd.includes(query)) {
      filteredPaletteItems.push({ type: 'cmd', name: cmd.name, cmd: cmd.cmd, action: cmd.action });
    }
  });

  // Open tabs matching query
  tabs.forEach(tab => {
    if (tab.title.toLowerCase().includes(query) || tab.url.toLowerCase().includes(query)) {
      filteredPaletteItems.push({ type: 'tab', name: tab.title, tabId: tab.id });
    }
  });

  paletteResults.innerHTML = '';
  filteredPaletteItems.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = `palette-item ${index === 0 ? 'active' : ''}`;
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = item.name;
    div.appendChild(nameSpan);

    const badgeSpan = document.createElement('span');
    if (item.type === 'cmd') {
      badgeSpan.className = 'palette-item-cmd';
      badgeSpan.textContent = item.cmd;
    } else {
      badgeSpan.className = 'palette-item-tab';
      badgeSpan.textContent = 'SEKME';
    }
    div.appendChild(badgeSpan);

    div.addEventListener('click', () => {
      executePaletteItem(item);
    });

    paletteResults.appendChild(div);
  });
}

function updatePaletteSelection() {
  const items = paletteResults.querySelectorAll('.palette-item');
  items.forEach((item, index) => {
    item.classList.toggle('active', index === paletteSelectedIndex);
    if (index === paletteSelectedIndex) {
      item.scrollIntoView({ block: 'nearest' });
    }
  });
}

function executePaletteItem(item) {
  commandPalette.classList.add('hidden');
  if (item.type === 'cmd') {
    item.action();
  } else if (item.type === 'tab') {
    switchTab(item.tabId);
  }
}

// Performance line graph canvas renderer
function drawPerformanceGraph() {
  if (!perfCanvas || !perfCtx) return;
  const width = perfCanvas.width;
  const height = perfCanvas.height;
  perfCtx.clearRect(0, 0, width, height);

  // Draw grid
  perfCtx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  perfCtx.lineWidth = 1;
  for (let i = 15; i < height; i += 15) {
    perfCtx.beginPath();
    perfCtx.moveTo(0, i);
    perfCtx.lineTo(width, i);
    perfCtx.stroke();
  }
  for (let i = 25; i < width; i += 25) {
    perfCtx.beginPath();
    perfCtx.moveTo(i, 0);
    perfCtx.lineTo(i, height);
    perfCtx.stroke();
  }

  if (memoryHistory.length < 2) return;

  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#7f00ff';
  
  const gradient = perfCtx.createLinearGradient(0, height, 0, 0);
  gradient.addColorStop(0, 'rgba(127, 0, 255, 0)');
  gradient.addColorStop(1, accentColor + '33');

  perfCtx.beginPath();
  const maxVal = 600; 
  const points = memoryHistory.map((val, idx) => {
    const x = (idx / 14) * width;
    const y = height - (Math.min(maxVal, val) / maxVal) * (height - 10) - 5;
    return { x, y };
  });

  perfCtx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    perfCtx.lineTo(points[i].x, points[i].y);
  }
  perfCtx.strokeStyle = accentColor;
  perfCtx.lineWidth = 2;
  perfCtx.stroke();

  perfCtx.lineTo(points[points.length - 1].x, height);
  perfCtx.lineTo(points[0].x, height);
  perfCtx.closePath();
  perfCtx.fillStyle = gradient;
  perfCtx.fill();

  const lastPoint = points[points.length - 1];
  perfCtx.beginPath();
  perfCtx.arc(lastPoint.x, lastPoint.y, 4, 0, 2 * Math.PI);
  perfCtx.fillStyle = accentColor;
  perfCtx.shadowColor = accentColor;
  perfCtx.shadowBlur = 8;
  perfCtx.fill();
  perfCtx.shadowBlur = 0;
}

// Audio Tab Mute indicator controller
function updateTabAudioStatus(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab || !tab.tabEl) return;

  const isAudible = tab.webviewEl && !tab.sleeping ? tab.webviewEl.isCurrentlyAudible() : false;
  const isMuted = tab.webviewEl && !tab.sleeping ? tab.webviewEl.isAudioMuted() : false;

  let audioBtn = tab.tabEl.querySelector('.tab-audio');
  
  if (isAudible) {
    if (!audioBtn) {
      audioBtn = document.createElement('button');
      audioBtn.className = 'tab-audio';
      const closeBtn = tab.tabEl.querySelector('.btn-close-tab');
      tab.tabEl.insertBefore(audioBtn, closeBtn);
      
      audioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (tab.webviewEl) {
          const currentlyMuted = tab.webviewEl.isAudioMuted();
          tab.webviewEl.setAudioMuted(!currentlyMuted);
          updateTabAudioStatus(tabId);
        }
      });
    }

    if (isMuted) {
      audioBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" fill="currentColor"/></svg>`;
      audioBtn.title = "Sesi Aç (Muted)";
    } else {
      audioBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/></svg>`;
      audioBtn.title = "Sustur (Mute)";
    }
  } else {
    if (audioBtn) audioBtn.remove();
  }
}

// Running reactive audio indicator polling loop
setInterval(() => {
  tabs.forEach(t => updateTabAudioStatus(t.id));
}, 1200);

// ==========================================================================
// 10. PRODUCTIVITY & LATENCY LOGIC (Ping, Bookmarks, Notes, Downloads)
// ==========================================================================

// Ping Latency Test Button Click Handler
document.getElementById('btn-ping-test').addEventListener('click', async () => {
  const pingDot = document.getElementById('ping-dot');
  const pingText = document.getElementById('ping-text');
  
  pingText.textContent = "Test...";
  pingDot.style.backgroundColor = '#64748b';
  pingDot.style.transform = 'scale(1.3)';
  
  const start = Date.now();
  try {
    // Mode no-cors and cache no-store ensures reliable server test
    await fetch('https://www.google.com/generate_204', { mode: 'no-cors', cache: 'no-store' });
    const ping = Date.now() - start;
    
    pingText.textContent = `${ping} ms`;
    pingDot.style.transform = '';

    if (ping < 60) {
      pingDot.style.backgroundColor = '#10b981'; // Green
      showToast(`Ping Ölçüldü: ${ping} ms (Kararlı & Akıcı)`);
    } else if (ping < 160) {
      pingDot.style.backgroundColor = '#f59e0b'; // Yellow
      showToast(`Ping Ölçüldü: ${ping} ms (Orta Derece Gecikme)`);
    } else {
      pingDot.style.backgroundColor = '#ef4444'; // Red
      showToast(`Ping Ölçüldü: ${ping} ms (Yüksek Gecikme!)`);
    }
  } catch (err) {
    pingText.textContent = "Offline";
    pingDot.style.transform = '';
    pingDot.style.backgroundColor = '#374151';
    showToast(`Ağ gecikmesi ölçülemedi. Çevrimdışı olabilirsiniz.`);
  }
});

// Bookmarks Bar Renderer & Manager
const bookmarksList = document.getElementById('bookmarks-list');
function renderBookmarks() {
  bookmarksList.innerHTML = '';
  if (bookmarks.length === 0) {
    bookmarksList.innerHTML = `<span style="font-size: 10px; color: var(--text-dim); padding-left: 4px;">Kayıtlı yer imi yok. Eklemek için Ctrl + D tuşlarına basın.</span>`;
    return;
  }
  bookmarks.forEach((bm, idx) => {
    const btn = document.createElement('button');
    btn.className = 'bookmark-btn';
    btn.innerHTML = `<svg viewBox="0 0 24 24" style="width: 10px; height: 10px; fill: currentColor;"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg> ${bm.title}`;
    
    // Open bookmark on left click
    btn.addEventListener('click', () => {
      navigate(bm.url);
    });

    // Delete bookmark on right click
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      bookmarks.splice(idx, 1);
      localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
      renderBookmarks();
      showToast(`Yer imi silindi: ${bm.title}`);
    });

    bookmarksList.appendChild(btn);
  });
}

// Ctrl + D Bookmarks Event Listener
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.code === 'KeyD') {
    e.preventDefault();
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab && activeTab.url !== 'lowbrowser://newtab') {
      const exists = bookmarks.some(bm => bm.url === activeTab.url);
      if (!exists) {
        bookmarks.push({ title: activeTab.title, url: activeTab.url });
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
        renderBookmarks();
        showToast(`Yer imlerine eklendi: ${activeTab.title}`);
      } else {
        showToast(`Bu sayfa zaten yer imlerinizde kayıtlı.`);
      }
    } else {
      showToast(`Bu sayfa yer imlerine eklenemez.`);
    }
  }
});

// Left Notes Panel (Quick Notes) Controller
const notesPanel = document.getElementById('notes-panel');
const notesTextarea = document.getElementById('notes-textarea');

// Load stored notes
notesTextarea.value = localStorage.getItem('lowbrowser_notes') || '';

// Auto-save on every keystroke
notesTextarea.addEventListener('input', () => {
  localStorage.setItem('lowbrowser_notes', notesTextarea.value);
});

document.getElementById('tool-btn-notes').addEventListener('click', () => {
  notesPanel.classList.toggle('hidden');
});

document.getElementById('btn-close-notes').addEventListener('click', () => {
  notesPanel.classList.add('hidden');
});

// Downloads Popover Drawer Controller
const downloadsBtn = document.getElementById('tool-btn-downloads');
const downloadsPanel = document.getElementById('downloads-panel');

downloadsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  downloadsPanel.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!downloadsPanel.contains(e.target) && e.target !== downloadsBtn) {
    downloadsPanel.classList.add('hidden');
  }
});

window.electronAPI.onDownloadStarted((data) => {
  downloadsList.push({
    id: data.id,
    filename: data.filename,
    totalBytes: data.totalBytes,
    receivedBytes: 0,
    state: 'downloading'
  });
  showToast(`İndirme başladı: ${data.filename}`);
  downloadsPanel.classList.remove('hidden'); // auto show panel
  renderDownloadsUI();
});

window.electronAPI.onDownloadUpdated((data) => {
  const dl = downloadsList.find(d => d.id === data.id);
  if (dl) {
    if (data.state) dl.state = data.state;
    if (data.receivedBytes) dl.receivedBytes = data.receivedBytes;
    renderDownloadsUI();
  }
});

window.electronAPI.onDownloadDone((data) => {
  const dl = downloadsList.find(d => d.id === data.id);
  if (dl) {
    dl.state = data.state;
    showToast(`İndirme bitti: ${dl.filename} (${data.state === 'completed' ? 'Tamamlandı' : 'Hata'})`);
    renderDownloadsUI();
  }
});

document.getElementById('btn-clear-downloads').addEventListener('click', () => {
  downloadsList = downloadsList.filter(d => d.state === 'downloading'); // keep active ones
  renderDownloadsUI();
});

function renderDownloadsUI() {
  const listContainer = document.getElementById('downloads-list');
  listContainer.innerHTML = '';

  if (downloadsList.length === 0) {
    listContainer.innerHTML = `<div class="empty-downloads">Aktif indirme bulunmuyor.</div>`;
    return;
  }

  downloadsList.forEach(dl => {
    const item = document.createElement('div');
    item.className = 'download-item';
    
    const percent = dl.totalBytes > 0 ? Math.round((dl.receivedBytes / dl.totalBytes) * 100) : 0;
    const receivedMB = (dl.receivedBytes / (1024 * 1024)).toFixed(1);
    const totalMB = (dl.totalBytes / (1024 * 1024)).toFixed(1);
    
    let statusLabel = 'İndiriliyor';
    if (dl.state === 'completed') statusLabel = 'Tamamlandı';
    else if (dl.state === 'cancelled') statusLabel = 'İptal edildi';
    else if (dl.state === 'interrupted') statusLabel = 'Kesintiye uğradı';

    item.innerHTML = `
      <div class="download-file-name" title="${dl.filename}">${dl.filename}</div>
      <div class="download-progress-bar">
        <div class="download-progress-fill" style="width: ${percent}%;"></div>
      </div>
      <div class="download-status-text">
        <span>${statusLabel} (%${percent})</span>
        <span>${receivedMB} MB / ${totalMB} MB</span>
      </div>
    `;
    listContainer.appendChild(item);
  });
}

function translateActiveTab() {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && activeTab.webviewEl && !activeTab.sleeping) {
    showToast("Sayfa Türkçe'ye çevriliyor...");
    
    const script = `
      (() => {
        let translateCombo = document.querySelector('.goog-te-combo');
        if (translateCombo) {
          translateCombo.value = 'tr';
          translateCombo.dispatchEvent(new Event('change'));
          return;
        }
        
        const div = document.createElement('div');
        div.id = 'google_translate_element';
        div.style.position = 'fixed';
        div.style.top = '-9999px';
        div.style.left = '-9999px';
        document.body.appendChild(div);
        
        window.googleTranslateElementInit = () => {
          new google.translate.TranslateElement({
            pageLanguage: 'auto',
            layout: google.translate.TranslateElement.InlineLayout.SIMPLE
          }, 'google_translate_element');
          
          const checkInterval = setInterval(() => {
            const select = document.querySelector('.goog-te-combo');
            if (select) {
              clearInterval(checkInterval);
              select.value = 'tr';
              select.dispatchEvent(new Event('change'));
              
              // Hide Google Translate standard header bar for native look
              const style = document.createElement('style');
              style.innerHTML = 'body { top: 0px !important; } .skiptranslate { display: none !important; }';
              document.head.appendChild(style);
            }
          }, 150);
          
          setTimeout(() => clearInterval(checkInterval), 10000);
        };
        
        const s = document.createElement('script');
        s.type = 'text/javascript';
        s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        document.head.appendChild(s);
      })();
    `;
    activeTab.webviewEl.executeJavaScript(script).catch(() => {});
  } else {
    showToast("Çevrilecek aktif sayfa bulunamadı.");
  }
}

// Bind click trigger for translate page
document.getElementById('tool-btn-translate').addEventListener('click', translateActiveTab);

// Dynamic Adaptive Brand Color Extraction Engine
function extractAndApplyBrandColor(url) {
  if (!url) return;
  
  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 16;
      canvas.height = 16;
      ctx.drawImage(img, 0, 0, 16, 16);
      
      const imgData = ctx.getImageData(0, 0, 16, 16).data;
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      
      for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i+1];
        const b = imgData[i+2];
        const a = imgData[i+3];
        
        if (a > 200) {
          const isWhite = r > 240 && g > 240 && b > 240;
          const isBlack = r < 25 && g < 25 && b < 25;
          if (!isWhite && !isBlack) {
            rSum += r;
            gSum += g;
            bSum += b;
            count++;
          }
        }
      }
      
      let finalColor = '';
      if (count > 0) {
        const avgR = Math.round(rSum / count);
        const avgG = Math.round(gSum / count);
        const avgB = Math.round(bSum / count);
        
        // Convert to HSL and enhance saturation/brightness for clean neon look
        const hsl = rgbToHsl(avgR, avgG, avgB);
        const s = Math.max(0.65, hsl.s);
        const l = 0.55; 
        finalColor = `hsl(${Math.round(hsl.h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
      } else {
        finalColor = '#7f00ff';
      }
      
      applyAdaptiveColor(finalColor);
    } catch (e) {
      applyAdaptiveColor('#7f00ff');
    }
  };
  img.onerror = () => {
    applyAdaptiveColor('#7f00ff');
  };
  img.src = url;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function applyAdaptiveColor(color) {
  if (currentTheme === 'adaptive') {
    document.documentElement.style.setProperty('--accent-color', color);
    const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (match) {
      const h = match[1];
      const s = match[2];
      const l = Math.max(35, parseInt(match[3]) - 10);
      document.documentElement.style.setProperty('--accent-hover', `hsl(${h}, ${s}%, ${l}%)`);
    } else {
      document.documentElement.style.setProperty('--accent-hover', '#6600cc');
    }
  }
}

function resetAdaptiveTheme() {
  if (currentTheme === 'custom') {
    const customAccent = localStorage.getItem('customAccentColor') || '#7f00ff';
    document.documentElement.style.setProperty('--accent-color', customAccent);
  } else {
    const colors = {
      purple: '#7f00ff',
      blue: '#0072ff',
      green: '#10b981',
      orange: '#f97316',
      pink: '#ec4899',
      adaptive: '#7f00ff'
    };
    const accent = colors[currentTheme] || '#7f00ff';
    document.documentElement.style.setProperty('--accent-color', accent);
  }
}

// ==========================================================================
// 10. TAB VOLUME MIXER, CLIPBOARD HISTORY & AUTOCOMPLETE SUGGESTIONS
// ==========================================================================

// --- 1. SEARCH SUGGESTIONS ENGINE ---
const suggestionsBox = document.getElementById('suggestions-box');
let suggestionSelectedIndex = -1;
let activeSuggestions = [];
let suggestionTimeout = null;

// Popular websites fallback list
const popularWebsites = [
  { name: 'YouTube', url: 'youtube.com' },
  { name: 'Google', url: 'google.com' },
  { name: 'GitHub', url: 'github.com' },
  { name: 'Facebook', url: 'facebook.com' },
  { name: 'Twitter (X)', url: 'twitter.com' },
  { name: 'Instagram', url: 'instagram.com' },
  { name: 'Netflix', url: 'netflix.com' },
  { name: 'Twitch', url: 'twitch.tv' },
  { name: 'Reddit', url: 'reddit.com' },
  { name: 'Wikipedia', url: 'wikipedia.org' }
];

addressInput.addEventListener('input', () => {
  clearTimeout(suggestionTimeout);
  suggestionTimeout = setTimeout(fetchAndShowSuggestions, 120);
});

addressInput.addEventListener('focus', () => {
  if (addressInput.value.trim().length > 0) {
    fetchAndShowSuggestions();
  }
});

// Hide suggestions when clicking outside
document.addEventListener('click', (e) => {
  if (!document.getElementById('address-bar-wrapper').contains(e.target)) {
    suggestionsBox.classList.add('hidden');
  }
});

// Keyboard navigation in suggestions list
addressInput.addEventListener('keydown', (e) => {
  if (suggestionsBox.classList.contains('hidden') || activeSuggestions.length === 0) {
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    suggestionSelectedIndex = (suggestionSelectedIndex + 1) % activeSuggestions.length;
    updateSuggestionSelection();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    suggestionSelectedIndex = (suggestionSelectedIndex - 1 + activeSuggestions.length) % activeSuggestions.length;
    updateSuggestionSelection();
  } else if (e.key === 'Escape') {
    suggestionsBox.classList.add('hidden');
  } else if (e.key === 'Enter') {
    // If user is highlighting an item, execute that item instead of standard navigation
    if (suggestionSelectedIndex >= 0 && suggestionSelectedIndex < activeSuggestions.length) {
      e.preventDefault();
      executeSuggestion(activeSuggestions[suggestionSelectedIndex]);
    }
  }
});

async function fetchAndShowSuggestions() {
  const query = addressInput.value.trim();
  if (query.length === 0) {
    suggestionsBox.classList.add('hidden');
    activeSuggestions = [];
    return;
  }

  suggestionSelectedIndex = -1;
  activeSuggestions = [];

  const lowerQuery = query.toLowerCase();

  // 1. Matches from Bookmarks
  bookmarks.forEach(bm => {
    if (bm.title && bm.title.trim().length > 0 && (bm.title.toLowerCase().includes(lowerQuery) || bm.url.toLowerCase().includes(lowerQuery))) {
      activeSuggestions.push({
        type: 'bookmark',
        title: bm.title,
        url: bm.url,
        display: bm.title
      });
    }
  });

  // 2. Matches from Open Tabs
  tabs.forEach(tab => {
    if (tab.title && tab.title.trim().length > 0 && (tab.title.toLowerCase().includes(lowerQuery) || tab.url.toLowerCase().includes(lowerQuery))) {
      activeSuggestions.push({
        type: 'tab',
        title: tab.title,
        url: tab.url,
        tabId: tab.id,
        display: `${tab.title} (Açık Sekme)`
      });
    }
  });

  // 3. Matches from Popular Sites
  popularWebsites.forEach(site => {
    if (site.name && site.name.trim().length > 0 && (site.name.toLowerCase().includes(lowerQuery) || site.url.toLowerCase().includes(lowerQuery))) {
      // Avoid duplication
      if (!activeSuggestions.some(s => s.url === site.url)) {
        activeSuggestions.push({
          type: 'popular',
          title: site.name,
          url: `https://${site.url}`,
          display: site.name
        });
      }
    }
  });

  // 4. Fetch Live Google Autocomplete Suggestions via IPC
  try {
    const data = await window.electronAPI.getGoogleSuggestions(query);
    if (data && data[1]) {
      // data[1] is an array of suggestion strings
      data[1].slice(0, 8).forEach(sugg => {
        if (!sugg || typeof sugg !== 'string' || sugg.trim().length === 0) {
          return;
        }
        // Avoid duplication
        if (!activeSuggestions.some(s => s.display && s.display.toLowerCase() === sugg.toLowerCase())) {
          activeSuggestions.push({
            type: 'search',
            title: sugg,
            url: `https://www.google.com/search?q=${encodeURIComponent(sugg)}`,
            display: sugg
          });
        }
      });
    }
  } catch (err) {
    console.error('[LowBrowser Suggestions] Fetch error:', err);
  }

  // Render suggestions box
  renderSuggestionsUI();
}

function renderSuggestionsUI() {
  if (activeSuggestions.length === 0) {
    suggestionsBox.classList.add('hidden');
    return;
  }

  suggestionsBox.innerHTML = '';
  activeSuggestions.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.dataset.index = idx;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'suggestion-content';

    let iconHtml = '';
    let badgeText = '';

    if (item.type === 'bookmark') {
      iconHtml = `<svg class="suggestion-icon icon" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="currentColor"/></svg>`;
      badgeText = 'Yer İmi';
    } else if (item.type === 'tab') {
      iconHtml = `<svg class="suggestion-icon icon" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v14zm-10-7h9v6h-9v-6z" fill="currentColor"/></svg>`;
      badgeText = 'Sekme';
    } else if (item.type === 'popular') {
      iconHtml = `<svg class="suggestion-icon icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor"/></svg>`;
      badgeText = 'Git';
    } else {
      iconHtml = `<svg class="suggestion-icon icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/></svg>`;
      badgeText = 'Ara';
    }

    contentDiv.innerHTML = `${iconHtml}<span class="suggestion-text">${item.display}</span>`;
    div.appendChild(contentDiv);

    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'suggestion-badge';
    badgeSpan.textContent = badgeText;
    div.appendChild(badgeSpan);

    div.addEventListener('click', () => {
      executeSuggestion(item);
    });

    suggestionsBox.appendChild(div);
  });

  suggestionsBox.classList.remove('hidden');
}

function updateSuggestionSelection() {
  const items = suggestionsBox.querySelectorAll('.suggestion-item');
  items.forEach(el => el.classList.remove('active'));

  if (suggestionSelectedIndex >= 0 && suggestionSelectedIndex < items.length) {
    const selectedEl = items[suggestionSelectedIndex];
    selectedEl.classList.add('active');

    // Fill address bar with choice
    const selectedItem = activeSuggestions[suggestionSelectedIndex];
    if (selectedItem.type === 'search') {
      addressInput.value = selectedItem.display;
    } else {
      addressInput.value = selectedItem.url;
    }
  }
}

function executeSuggestion(item) {
  suggestionsBox.classList.add('hidden');
  if (item.type === 'tab' && item.tabId) {
    switchTab(item.tabId);
  } else {
    // Navigate URL or Google search
    navigateToUrl(item.url);
  }
}

function navigateToUrl(url) {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab) {
    if (activeTab.url === 'lowbrowser://newtab') {
      // Re-create webview
      activeTab.url = url;
      startPage.classList.add('hidden');
      
      const webviewEl = document.createElement('webview');
      webviewEl.setAttribute('id', `wv_${activeTab.id}`);
      webviewEl.setAttribute('src', url);
      webviewEl.setAttribute('preload', window.electronAPI.preloadPath);
      if (activeTab.isPrivate) {
        webviewEl.setAttribute('partition', 'private_session');
      }
      webviewsContainer.appendChild(webviewEl);
      setupWebviewEvents(webviewEl, activeTab.id);
      activeTab.webviewEl = webviewEl;
      
      setTimeout(() => {
        if (webviewEl) webviewEl.focus();
      }, 50);
    } else if (activeTab.webviewEl) {
      activeTab.webviewEl.setAttribute('src', url);
    }
    addressInput.value = url;
  }
}


// --- 2. TAB VOLUME MIXER LOGIC ---
const volumeBtn = document.getElementById('tool-btn-volume');
const volumePanel = document.getElementById('volume-panel');
const volumeList = document.getElementById('volume-list');

volumeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  renderVolumeUI();
  volumePanel.classList.toggle('hidden');
});

// Close volume panel when clicking outside
document.addEventListener('click', (e) => {
  if (!volumePanel.contains(e.target) && e.target !== volumeBtn) {
    volumePanel.classList.add('hidden');
  }
});

function renderVolumeUI() {
  volumeList.innerHTML = '';
  
  // List only open (non-sleeping) tabs
  const activeTabs = tabs.filter(t => !t.sleeping);
  
  if (activeTabs.length === 0) {
    volumeList.innerHTML = '<div class="empty-volume">Ses çalan aktif sekme bulunmuyor.</div>';
    return;
  }

  activeTabs.forEach(tab => {
    const row = document.createElement('div');
    row.className = 'volume-row';

    const info = document.createElement('div');
    info.className = 'volume-info';
    info.innerHTML = `
      <span class="volume-tab-title" title="${tab.title}">${tab.title}</span>
    `;
    row.appendChild(info);

    const control = document.createElement('div');
    control.className = 'volume-control';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'volume-slider';
    slider.min = '0';
    slider.max = '100';
    slider.value = Math.round((tab.volume || 1) * 100);

    const percentage = document.createElement('span');
    percentage.className = 'volume-percentage';
    percentage.textContent = `%${slider.value}`;

    control.appendChild(slider);
    control.appendChild(percentage);
    row.appendChild(control);

    // Bind slider input change
    slider.addEventListener('input', () => {
      const vol = slider.value / 100;
      tab.volume = vol;
      percentage.textContent = `%${slider.value}`;

      // Enject volume adjustment inside the webview content
      if (tab.webviewEl) {
        tab.webviewEl.executeJavaScript(`
          document.querySelectorAll('video, audio').forEach(el => {
            el.volume = ${vol};
          });
        `).catch(() => {});
      }
    });

    volumeList.appendChild(row);
  });
}


// --- 3. CLIPBOARD MANAGER LOGIC ---
const clipboardBtn = document.getElementById('tool-btn-clipboard');
const clipboardPanel = document.getElementById('clipboard-panel');
const clipboardList = document.getElementById('clipboard-list');

let clipboardHistory = JSON.parse(localStorage.getItem('lowbrowser_clipboard_history')) || [];

clipboardBtn.addEventListener('click', () => {
  renderClipboardUI();
  clipboardPanel.classList.toggle('hidden');
});

document.getElementById('btn-close-clipboard').addEventListener('click', () => {
  clipboardPanel.classList.add('hidden');
});

// Clipboard watcher perodic check
setInterval(async () => {
  try {
    const text = await window.electronAPI.readClipboard();
    if (text && text.trim().length > 0 && text.length < 2000) {
      const cleanText = text.trim();
      // If it's new, add to clipboardHistory
      if (clipboardHistory.length === 0 || clipboardHistory[0] !== cleanText) {
        // Remove duplicate if it exists elsewhere
        clipboardHistory = clipboardHistory.filter(item => item !== cleanText);
        // Add to front
        clipboardHistory.unshift(cleanText);
        // Cap to 20 items
        clipboardHistory = clipboardHistory.slice(0, 20);
        
        localStorage.setItem('lowbrowser_clipboard_history', JSON.stringify(clipboardHistory));
        
        // Refresh UI if panel is open
        if (!clipboardPanel.classList.contains('hidden')) {
          renderClipboardUI();
        }
      }
    }
  } catch (err) {}
}, 1500);

function renderClipboardUI() {
  clipboardList.innerHTML = '';
  
  if (clipboardHistory.length === 0) {
    clipboardList.innerHTML = '<div class="empty-clipboard">Kopyalama geçmişiniz boş.</div>';
    return;
  }

  clipboardHistory.forEach(text => {
    const item = document.createElement('div');
    item.className = 'clipboard-item';
    item.textContent = text;
    item.title = "Tekrar panoya kopyalamak için tıklayın";

    item.addEventListener('click', () => {
      window.electronAPI.writeClipboard(text);
      showToast("Panoya kopyalandı!");
    });

    clipboardList.appendChild(item);
  });
}

// --- 4. BROWSING HISTORY LOGIC (Capped at 300 entries) ---
const historyBtn = document.getElementById('tool-btn-history');
const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');

historyBtn.addEventListener('click', () => {
  renderHistoryUI();
  historyPanel.classList.toggle('hidden');
});

document.getElementById('btn-close-history').addEventListener('click', () => {
  historyPanel.classList.add('hidden');
});

document.getElementById('btn-clear-history').addEventListener('click', () => {
  localStorage.removeItem('lowbrowser_history');
  renderHistoryUI();
  showToast("Tarama geçmişi temizlendi.");
});

function addToHistory(title, url, isPrivate) {
  if (isPrivate || !url || url.startsWith('lowbrowser://')) return;
  
  let history = JSON.parse(localStorage.getItem('lowbrowser_history')) || [];
  
  // Prevent consecutive duplicates
  if (history.length > 0 && history[0].url === url) return;
  
  history.unshift({
    title: title || url,
    url: url,
    time: Date.now()
  });
  
  // Cap at 300 entries!
  if (history.length > 300) {
    history = history.slice(0, 300);
  }
  
  localStorage.setItem('lowbrowser_history', JSON.stringify(history));
  
  if (!historyPanel.classList.contains('hidden')) {
    renderHistoryUI();
  }
}

function renderHistoryUI() {
  historyList.innerHTML = '';
  const history = JSON.parse(localStorage.getItem('lowbrowser_history')) || [];
  
  if (history.length === 0) {
    historyList.innerHTML = '<div class="empty-history">Henüz tarama geçmişi bulunmuyor.</div>';
    return;
  }

  history.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <span class="history-item-title">${item.title}</span>
      <span class="history-item-url">${item.url}</span>
    `;
    
    div.addEventListener('click', () => {
      navigateToUrl(item.url);
      historyPanel.classList.add('hidden');
    });

    historyList.appendChild(div);
  });
}


// --- 5. PASSWORD VAULT & AUTOFILL LOGIC ---
const passwordsBtn = document.getElementById('tool-btn-passwords');
const passwordsPanel = document.getElementById('passwords-panel');
const passwordsList = document.getElementById('passwords-list');
const btnAutofillKey = document.getElementById('btn-autofill-key');

let savedPasswords = JSON.parse(localStorage.getItem('lowbrowser_saved_passwords')) || [];

passwordsBtn.addEventListener('click', () => {
  renderPasswordsUI();
  passwordsPanel.classList.toggle('hidden');
});

document.getElementById('btn-close-passwords').addEventListener('click', () => {
  passwordsPanel.classList.add('hidden');
});

// Save password manual form trigger
document.getElementById('btn-save-password').addEventListener('click', () => {
  const urlInp = document.getElementById('pass-add-url').value.trim();
  const userInp = document.getElementById('pass-add-user').value.trim();
  const wordInp = document.getElementById('pass-add-word').value.trim();

  if (!urlInp || !userInp || !wordInp) {
    showToast("Lütfen tüm alanları doldurun.");
    return;
  }

  // Sanitize url to simple domain
  let cleanDomain = urlInp;
  try {
    if (!cleanDomain.startsWith('http')) {
      cleanDomain = 'https://' + cleanDomain;
    }
    cleanDomain = new URL(cleanDomain).hostname.replace('www.', '');
  } catch(e) {}

  savedPasswords.push({
    url: cleanDomain,
    user: userInp,
    pass: wordInp
  });

  localStorage.setItem('lowbrowser_saved_passwords', JSON.stringify(savedPasswords));
  
  // Clear inputs
  document.getElementById('pass-add-url').value = '';
  document.getElementById('pass-add-user').value = '';
  document.getElementById('pass-add-word').value = '';

  renderPasswordsUI();
  checkPasswordsForCurrentTab();
  showToast("Şifre başarıyla kaydedildi!");
});

// Single-click autofill execution
btnAutofillKey.addEventListener('click', () => {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (!activeTab || activeTab.url.startsWith('lowbrowser://')) return;

  try {
    const domain = new URL(activeTab.url).hostname.replace('www.', '');
    const entry = savedPasswords.find(p => p.url.includes(domain));
    if (entry) {
      autoFillCredentials(entry.user, entry.pass);
      showToast("Şifre otomatik dolduruldu!");
    }
  } catch (err) {}
});

function autoFillCredentials(username, password) {
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab && activeTab.webviewEl) {
    const code = `
      (() => {
        const passInput = document.querySelector('input[type="password"]');
        if (passInput) {
          passInput.value = "${password}";
          passInput.dispatchEvent(new Event('input', { bubbles: true }));
          passInput.dispatchEvent(new Event('change', { bubbles: true }));
          
          let form = passInput.form;
          let userInput = null;
          if (form) {
            userInput = form.querySelector('input[type="text"], input[type="email"], input:not([type])');
          } else {
            userInput = document.querySelector('input[type="text"], input[type="email"]');
          }
          if (userInput) {
            userInput.value = "${username}";
            userInput.dispatchEvent(new Event('input', { bubbles: true }));
            userInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      })();
    `;
    activeTab.webviewEl.executeJavaScript(code).catch(() => {});
  }
}

function checkPasswordsForCurrentTab() {
  const activeTab = tabs.find(t => t.id === activeTabId);
  const btnKey = document.getElementById('btn-autofill-key');
  if (!activeTab || activeTab.url.startsWith('lowbrowser://')) {
    btnKey.classList.add('hidden');
    return;
  }
  
  try {
    const domain = new URL(activeTab.url).hostname.replace('www.', '');
    const saved = savedPasswords.find(p => p.url.includes(domain));
    if (saved) {
      btnKey.classList.remove('hidden');
    } else {
      btnKey.classList.add('hidden');
    }
  } catch (e) {
    btnKey.classList.add('hidden');
  }
}

function renderPasswordsUI() {
  passwordsList.innerHTML = '';
  
  if (savedPasswords.length === 0) {
    passwordsList.innerHTML = '<div class="empty-passwords">Kaydedilmiş şifre bulunmuyor.</div>';
    return;
  }

  savedPasswords.forEach((entry, idx) => {
    const row = document.createElement('div');
    row.className = 'password-row';
    row.innerHTML = `
      <div class="password-row-domain">${entry.url}</div>
      <div class="password-row-user">Kullanıcı: ${entry.user}</div>
      <div class="password-row-actions">
        <button class="btn-delete-password" data-index="${idx}">Sil</button>
      </div>
    `;

    row.querySelector('.btn-delete-password').addEventListener('click', (e) => {
      const indexToDelete = parseInt(e.target.dataset.index);
      savedPasswords.splice(indexToDelete, 1);
      localStorage.setItem('lowbrowser_saved_passwords', JSON.stringify(savedPasswords));
      renderPasswordsUI();
      checkPasswordsForCurrentTab();
      showToast("Şifre silindi.");
    });

    passwordsList.appendChild(row);
  });
}

// --- 6. TOOLS MENU POPOVER CONTROLLER ---
const toolsMenuBtn = document.getElementById('btn-tools-menu');
const toolsMenuPopover = document.getElementById('tools-menu-popover');

toolsMenuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  // Close other popovers
  if (typeof downloadsPanel !== 'undefined') downloadsPanel.classList.add('hidden');
  if (typeof volumePanel !== 'undefined') volumePanel.classList.add('hidden');
  if (typeof shieldPopover !== 'undefined') shieldPopover.classList.add('hidden');
  
  toolsMenuPopover.classList.toggle('hidden');
});

// Close tools menu when clicking outside
document.addEventListener('click', (e) => {
  if (!toolsMenuPopover.contains(e.target) && e.target !== toolsMenuBtn) {
    toolsMenuPopover.classList.add('hidden');
  }
});

// Close tools menu when any sub-tool item is clicked (for cleaner UX)
toolsMenuPopover.querySelectorAll('.tool-item').forEach(item => {
  item.addEventListener('click', () => {
    toolsMenuPopover.classList.add('hidden');
  });
});

// --- 7. NEW TAB CUSTOM BACKGROUND CONTROLLER ---
const newTabBgBtn = document.getElementById('btn-newtab-bg');
const startPageEl = document.getElementById('start-page');

const newTabBackgrounds = ['bg-neon-eclipse', 'bg-midnight-aurora', 'bg-cyberpunk-grid', 'bg-velvet-sunset', 'bg-minimal-dark'];
const bgDisplayNames = {
  'bg-neon-eclipse': 'Neon Eclipse',
  'bg-midnight-aurora': 'Gece Aurorası',
  'bg-cyberpunk-grid': 'Cyberpunk Izgarası',
  'bg-velvet-sunset': 'Kadife Gün Batımı',
  'bg-minimal-dark': 'Minimal Karanlık'
};

let currentBgClass = localStorage.getItem('lowbrowser_newtab_bg') || 'bg-neon-eclipse';

function applyNewTabBackground(bgClass) {
  newTabBackgrounds.forEach(cls => startPageEl.classList.remove(cls));
  startPageEl.classList.add(bgClass);
}

newTabBgBtn.addEventListener('click', () => {
  const currentIndex = newTabBackgrounds.indexOf(currentBgClass);
  const nextIndex = (currentIndex + 1) % newTabBackgrounds.length;
  currentBgClass = newTabBackgrounds[nextIndex];
  
  localStorage.setItem('lowbrowser_newtab_bg', currentBgClass);
  applyNewTabBackground(currentBgClass);
  
  showToast(`Arka Plan: ${bgDisplayNames[currentBgClass]}`);
});

// Apply selected background on initialization
applyNewTabBackground(currentBgClass);

// Dynamic logo background pixel removing engine (Converts solid dark pixels to absolute alpha transparency)
function makeLogoTransparent() {
  const logoImg = document.querySelector('#start-logo img');
  if (!logoImg) return;
  
  const img = new Image();
  img.src = logoImg.src;
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        const brightness = (r + g + b) / 3;
        
        // Remove dark pixels (convert to transparent)
        if (brightness < 45) {
          if (brightness < 20) {
            data[i+3] = 0; // Pure transparent
          } else {
            // Anti-alias edge smoothing
            data[i+3] = Math.round(((brightness - 20) / 25) * 255);
          }
        }
      }
      
      ctx.putImageData(imgData, 0, 0);
      logoImg.src = canvas.toDataURL();
      logoImg.style.mixBlendMode = 'normal';
      logoImg.style.filter = 'none';
    } catch (e) {
      console.error('[LowBrowser Logo Engine] Error transparentizing logo:', e);
    }
  };
}



// --- 8. CUSTOMISABLE SPEED DIALS ENGINE ---
const speedDialsContainer = document.getElementById('speed-dials');
const modalAddDial = document.getElementById('modal-add-dial');
const dialNameInput = document.getElementById('dial-name-input');
const dialUrlInput = document.getElementById('dial-url-input');

let speedDials = JSON.parse(localStorage.getItem('lowbrowser_speed_dials')) || [
  { name: 'Twitch', url: 'https://www.twitch.tv' },
  { name: 'Discord', url: 'https://discord.com' },
  { name: 'tracker.gg', url: 'https://tracker.gg/valorant' },
  { name: 'YouTube', url: 'https://www.youtube.com' }
];

function renderSpeedDials() {
  if (!speedDialsContainer) return;
  speedDialsContainer.innerHTML = '';
  
  speedDials.forEach((dial, index) => {
    const card = document.createElement('div');
    card.className = 'dial-card gamer-card';
    card.dataset.url = dial.url;
    
    const titleSpan = document.createElement('span');
    titleSpan.className = 'gamer-card-title';
    titleSpan.textContent = dial.name;
    card.appendChild(titleSpan);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete-dial';
    deleteBtn.title = 'Kartı Sil';
    deleteBtn.textContent = '✕';
    
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent navigation click
      speedDials.splice(index, 1);
      localStorage.setItem('lowbrowser_speed_dials', JSON.stringify(speedDials));
      renderSpeedDials();
      showToast("Hızlı erişim kartı silindi.");
    });
    
    card.appendChild(deleteBtn);
    
    card.addEventListener('click', () => {
      // Navigate active tab
      const activeTabId = getActiveTabId();
      if (activeTabId) {
        navigateTo(activeTabId, dial.url);
      }
    });
    
    speedDialsContainer.appendChild(card);
  });
  
  // Create "+" Add button card
  const addCard = document.createElement('div');
  addCard.className = 'dial-card add-dial-card';
  addCard.title = 'Yeni Hızlı Erişim Ekle';
  addCard.textContent = '+';
  
  addCard.addEventListener('click', () => {
    dialNameInput.value = '';
    dialUrlInput.value = '';
    modalAddDial.classList.remove('hidden');
    dialNameInput.focus();
  });
  
  speedDialsContainer.appendChild(addCard);
}

document.getElementById('btn-cancel-dial').addEventListener('click', () => {
  modalAddDial.classList.add('hidden');
});

document.getElementById('btn-confirm-dial').addEventListener('click', () => {
  const name = dialNameInput.value.trim();
  let url = dialUrlInput.value.trim();
  
  if (!name || !url) {
    showToast("Lütfen tüm alanları doldurun!");
    return;
  }
  
  // Format URL if protocol is missing
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  
  speedDials.push({ name, url });
  localStorage.setItem('lowbrowser_speed_dials', JSON.stringify(speedDials));
  renderSpeedDials();
  
  modalAddDial.classList.add('hidden');
  showToast("Hızlı erişim kartı eklendi.");
});

// Close modal when clicking outside box
modalAddDial.addEventListener('click', (e) => {
  if (e.target === modalAddDial) {
    modalAddDial.classList.add('hidden');
  }
});

// --- 9. SCREENSHOT & PIP MULTIMEDIA CONTROLLER ---
const btnToolScreenshot = document.getElementById('tool-btn-screenshot');
const btnToolPip = document.getElementById('tool-btn-pip');
const flashOverlay = document.getElementById('screenshot-flash-overlay');

// 📸 Screenshot logic
if (btnToolScreenshot) {
  btnToolScreenshot.addEventListener('click', async () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    try {
      let dataUrl = '';
      if (!activeTab.url || activeTab.url === 'lowbrowser://newtab') {
        showToast("📸 Başlangıç sayfasındasınız. Web sayfalarını yakalamak için bir siteye gidin.");
        return;
      }

      const wv = document.getElementById(`webview-${activeTab.id}`);
      if (!wv) {
        showToast("Yakalanacak aktif web sayfası bulunamadı.");
        return;
      }

      // Flash effect animation
      if (flashOverlay) {
        flashOverlay.classList.add('flash');
        setTimeout(() => {
          flashOverlay.classList.remove('flash');
        }, 80);
      }

      // Capture visible webview page
      const nativeImg = await wv.capturePage();
      dataUrl = nativeImg.toDataURL();

      // Copy to clipboard immediately
      if (window.electronAPI && window.electronAPI.copyImageToClipboard) {
        window.electronAPI.copyImageToClipboard(dataUrl);
      }

      // Show interactive toast
      showScreenshotToast(dataUrl);

    } catch (err) {
      console.error('[LowBrowser Screenshot] Capture error:', err);
      showToast("Ekran görüntüsü alınırken hata oluştu.");
    }
  });
}

function showScreenshotToast(dataUrl) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #0c0d12;
    border: 1px solid rgba(127, 0, 255, 0.4);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
    border-radius: 10px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 999999;
    color: white;
    font-size: 12px;
    font-weight: 500;
  `;

  toast.innerHTML = `
    <span>📸 Ekran görüntüsü panoya kopyalandı!</span>
    <button id="btn-toast-save-shot" style="
      background: var(--accent-color);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    ">Dosyaya Kaydet</button>
    <button id="btn-toast-close-shot" style="
      background: transparent;
      color: var(--text-dim);
      border: none;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
    ">✕</button>
  `;

  document.body.appendChild(toast);

  toast.querySelector('#btn-toast-save-shot').addEventListener('click', async () => {
    if (window.electronAPI && window.electronAPI.saveScreenshot) {
      const res = await window.electronAPI.saveScreenshot(dataUrl);
      if (res && res.success) {
        showToast("Görsel başarıyla kaydedildi!");
      }
    }
    toast.remove();
  });

  toast.querySelector('#btn-toast-close-shot').addEventListener('click', () => {
    toast.remove();
  });

  setTimeout(() => {
    if (document.body.contains(toast)) {
      toast.remove();
    }
  }, 6000);
}

// 🔲 Video Picture-in-Picture (PiP) logic
if (btnToolPip) {
  btnToolPip.addEventListener('click', async () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || !activeTab.url || activeTab.url.startsWith('lowbrowser://')) {
      showToast("Aktif sayfada video bulunmuyor.");
      return;
    }

    const wv = document.getElementById(`webview-${activeTab.id}`);
    if (!wv) return;

    try {
      const result = await wv.executeJavaScript(`
        (async () => {
          try {
            if (document.pictureInPictureElement) {
              await document.exitPictureInPicture();
              return { success: true, action: 'exited' };
            }
            const videos = Array.from(document.querySelectorAll('video'));
            const activeVideo = videos.find(v => !v.paused && v.readyState > 1) || videos[0];
            if (activeVideo) {
              await activeVideo.requestPictureInPicture();
              return { success: true, action: 'entered' };
            }
            return { success: false, reason: 'no-video' };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })()
      `);

      if (result && result.success) {
        if (result.action === 'entered') {
          showToast("🔲 Video köşeye sabitlendi (PiP)");
        } else {
          showToast("Video orijinal sayfaya döndürüldü.");
        }
      } else if (result && result.reason === 'no-video') {
        showToast("Sayfada oynatılabilir bir video bulunamadı.");
      } else {
        showToast("PiP açılamadı: " + (result.error || 'Desteklenmiyor'));
      }
    } catch (err) {
      console.error('[LowBrowser PiP] Execution error:', err);
      showToast("Video PiP modu çalıştırılamadı.");
    }
  });
}

// --- 10. SECURE DNS (DoH) CONTROLLER ---
let isDohEnabled = localStorage.getItem('isDohEnabled') !== 'false';
let dohProvider = localStorage.getItem('dohProvider') || 'cloudflare';

const dohProviderNames = {
  cloudflare: 'Cloudflare DNS (1.1.1.1)',
  google: 'Google Public DNS (8.8.8.8)',
  quad9: 'Quad9 (9.9.9.9)',
  adguard: 'AdGuard DNS'
};

const btnToolDns = document.getElementById('tool-btn-dns');
const switchSecureDns = document.getElementById('switch-secure-dns');
const dnsStatusBadge = document.getElementById('dns-status-badge');
const dnsStatusText = document.getElementById('dns-status-text');

function updateDohUI() {
  const providerName = dohProviderNames[dohProvider] || dohProvider;

  if (switchSecureDns) {
    switchSecureDns.checked = isDohEnabled;
  }

  if (btnToolDns) {
    btnToolDns.classList.toggle('dns-active', isDohEnabled);
  }

  if (dnsStatusBadge && dnsStatusText) {
    if (isDohEnabled) {
      dnsStatusBadge.classList.remove('disabled');
      dnsStatusText.textContent = `Güvenli DNS Aktif: ${providerName} ile şifreleniyor.`;
    } else {
      dnsStatusBadge.classList.add('disabled');
      dnsStatusText.textContent = 'Güvenli DNS Kapalı: Standart ISS sağlayıcısı kullanılıyor.';
    }
  }

  document.querySelectorAll('input[name="dns-provider"]').forEach(radio => {
    radio.checked = radio.value === dohProvider;
    radio.disabled = !isDohEnabled;
  });
}

// Tool menu quick toggle button
if (btnToolDns) {
  btnToolDns.addEventListener('click', () => {
    isDohEnabled = !isDohEnabled;
    localStorage.setItem('isDohEnabled', isDohEnabled);
    updateDohUI();
    const providerName = dohProviderNames[dohProvider] || dohProvider;
    showToast(isDohEnabled ? `⚡ Güvenli DNS Açıldı (${providerName})` : "Güvenli DNS Kapatıldı.");
  });
}

// Studio toggle switch
if (switchSecureDns) {
  switchSecureDns.addEventListener('change', (e) => {
    isDohEnabled = e.target.checked;
    localStorage.setItem('isDohEnabled', isDohEnabled);
    updateDohUI();
    const providerName = dohProviderNames[dohProvider] || dohProvider;
    showToast(isDohEnabled ? `⚡ Güvenli DNS Açıldı (${providerName})` : "Güvenli DNS Kapatıldı.");
  });
}

// DNS Provider radio change
document.querySelectorAll('input[name="dns-provider"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    dohProvider = e.target.value;
    localStorage.setItem('dohProvider', dohProvider);
    updateDohUI();
    const providerName = dohProviderNames[dohProvider] || dohProvider;
    showToast(`🌐 DNS Sağlayıcısı Değiştirildi: ${providerName}`);
  });
});

updateDohUI();

// Initialise layout components
renderBookmarks();
createTab();
makeLogoTransparent();
renderSpeedDials();
