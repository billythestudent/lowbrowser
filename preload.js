const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

// Expose Electron APIs to renderer process safely
contextBridge.exposeInMainWorld('electronAPI', {
  preloadPath: path.join(__dirname, 'preload.js'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  getStats: () => ipcRenderer.invoke('get-browser-stats'),
  toggleAdBlock: (enabled) => ipcRenderer.send('toggle-adblock', enabled),
  triggerGC: () => { if (window.gc) window.gc(); },
  onAdBlocked: (callback) => ipcRenderer.on('ad-blocked', (event, url) => callback(url)),
  onDownloadStarted: (callback) => ipcRenderer.on('download-started', (event, data) => callback(data)),
  onDownloadUpdated: (callback) => ipcRenderer.on('download-updated', (event, data) => callback(data)),
  onDownloadDone: (callback) => ipcRenderer.on('download-done', (event, data) => callback(data)),
  readClipboard: () => ipcRenderer.invoke('clipboard-read'),
  writeClipboard: (text) => ipcRenderer.send('clipboard-write', text),
  copyImageToClipboard: (dataUrl) => ipcRenderer.send('clipboard-write-image', dataUrl),
  saveScreenshot: (dataUrl) => ipcRenderer.invoke('save-screenshot-dialog', dataUrl),
  getGoogleSuggestions: (query) => ipcRenderer.invoke('google-suggest', query)
});

// Guest page video detection and floating PiP overlay button
window.addEventListener('DOMContentLoaded', () => {
  // Inject CSS styles into guest page (PiP and Translation overlay components)
  const style = document.createElement('style');
  style.innerHTML = `
    /* Floating PiP Button */
    .lowbrowser-fixed-pip-btn {
      position: fixed !important;
      top: 12px !important;
      left: 50% !important;
      transform: translateX(-50%) translateY(-20px) !important;
      z-index: 2147483647 !important;
      background: rgba(12, 13, 18, 0.9) !important;
      backdrop-filter: blur(8px) !important;
      border: 1px solid rgba(255, 255, 255, 0.15) !important;
      border-radius: 20px !important;
      padding: 6px 12px !important;
      color: #ffffff !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      cursor: pointer !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4) !important;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease, background 0.15s !important;
      opacity: 0 !important;
      pointer-events: none !important;
      user-select: none !important;
    }
    .lowbrowser-fixed-pip-btn.visible {
      opacity: 0.9 !important;
      transform: translateX(-50%) translateY(0) !important;
      pointer-events: auto !important;
    }
    .lowbrowser-fixed-pip-btn.visible:hover {
      opacity: 1 !important;
      transform: translateX(-50%) scale(1.05) !important;
      background: #7f00ff !important;
      border-color: #7f00ff !important;
    }
    .lowbrowser-fixed-pip-btn svg {
      width: 14px !important;
      height: 14px !important;
      fill: currentColor !important;
    }

    /* Selection Translation Trigger Bubble */
    .lowbrowser-translate-bubble {
      position: absolute !important;
      z-index: 2147483646 !important;
      background: #7f00ff !important;
      color: #ffffff !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      border-radius: 50% !important;
      width: 26px !important;
      height: 26px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
      transition: transform 0.15s ease !important;
      pointer-events: auto !important;
      padding: 0 !important;
      line-height: 0 !important;
    }
    .lowbrowser-translate-bubble:hover {
      transform: scale(1.1) !important;
      background: #9333ff !important;
    }
    .lowbrowser-translate-bubble svg {
      width: 12px !important;
      height: 12px !important;
      fill: currentColor !important;
    }
    
    /* Selection Translation Result Tooltip Box */
    .lowbrowser-translate-tooltip {
      position: absolute !important;
      z-index: 2147483646 !important;
      background: #0f1016 !important;
      border: 1px solid rgba(127, 0, 255, 0.4) !important;
      border-radius: 8px !important;
      padding: 10px 14px !important;
      max-width: 280px !important;
      color: #e2e8f0 !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      font-size: 12px !important;
      line-height: 1.5 !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5) !important;
      pointer-events: auto !important;
      text-align: left !important;
    }
    
    .lowbrowser-translate-tooltip-header {
      font-size: 9px !important;
      font-weight: 700 !important;
      text-transform: uppercase !important;
      color: #a78bfa !important;
      margin-bottom: 6px !important;
      display: flex !important;
      align-items: center !important;
      gap: 4px !important;
      letter-spacing: 0.5px !important;
    }

    /* CSS Loading Spinner */
    .lowbrowser-translate-bubble svg.spinner {
      animation: lowbrowser-rotate 1.5s linear infinite !important;
    }
    .lowbrowser-translate-bubble svg.spinner .path {
      stroke: #ffffff;
      stroke-linecap: round;
      animation: lowbrowser-dash 1.5s ease-in-out infinite !important;
    }
    @keyframes lowbrowser-rotate {
      100% { transform: rotate(360deg); }
    }
    @keyframes lowbrowser-dash {
      0% {
        stroke-dasharray: 1, 150;
        stroke-dashoffset: 0;
      }
      50% {
        stroke-dasharray: 90, 150;
        stroke-dashoffset: -35;
      }
      100% {
        stroke-dasharray: 90, 150;
        stroke-dashoffset: -124;
      }
    }
  `;
  document.head.appendChild(style);

  // 1. Setup floating PiP button elements & tracker
  const pipBtn = document.createElement('div');
  pipBtn.className = 'lowbrowser-fixed-pip-btn';
  pipBtn.title = 'Resim içinde Resim (PiP) Modunu Aç';
  pipBtn.innerHTML = `
    <svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v14zm-10-7h9v6h-9v-6z"/></svg>
    <span>Pencereyi Ayır (PiP)</span>
  `;
  
  let targetVideo = null;
  
  pipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (targetVideo) {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture();
      } else {
        targetVideo.requestPictureInPicture().catch(err => {
          console.error('[LowBrowser PiP] Failed to enter PiP:', err);
        });
      }
    }
  });
  
  document.body.appendChild(pipBtn);

  // Monitor active playing videos for PiP trigger
  setInterval(() => {
    const videos = Array.from(document.querySelectorAll('video'));
    const activeVideo = videos.find(v => {
      return v.offsetWidth >= 150 && v.offsetHeight >= 100 && !v.paused && !v.ended;
    });

    if (activeVideo) {
      targetVideo = activeVideo;
      pipBtn.classList.add('visible');
    } else {
      if (document.pictureInPictureElement) {
        pipBtn.classList.add('visible');
      } else {
        pipBtn.classList.remove('visible');
      }
    }
  }, 1000);

  // 2. Setup Selection-based translation tooltip bubble
  let activeBubble = null;
  let activeTooltip = null;
  let selectedText = '';

  document.addEventListener('mouseup', (e) => {
    // Prevent removing items if clicking inside active tooltip or bubble
    if (activeTooltip && activeTooltip.contains(e.target)) return;
    if (activeBubble && activeBubble.contains(e.target)) return;

    removeTranslateElements();

    const selection = window.getSelection();
    selectedText = selection.toString().trim();

    // Check if selection is a non-empty text string
    if (selectedText.length > 1) {
      const range = selection.getRangeAt(0);
      const rects = range.getClientRects();
      if (rects.length > 0) {
        const rect = rects[0];
        
        // Create Selection Bubble
        const bubble = document.createElement('div');
        bubble.className = 'lowbrowser-translate-bubble';
        bubble.title = "Seçilen Metni Türkçe'ye Çevir";
        bubble.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>`;
        
        // Position bubble above the selection
        const x = rect.left + window.scrollX + (rect.width / 2) - 13;
        const y = rect.top + window.scrollY - 32;
        bubble.style.left = `${x}px`;
        bubble.style.top = `${y}px`;
        
        bubble.addEventListener('click', async (clickEvent) => {
          clickEvent.stopPropagation();
          // Change icon to loader spinner
          bubble.innerHTML = `<svg class="spinner" viewBox="0 0 50 50" style="width: 14px; height: 14px; fill: none;"><circle class="path" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5"></circle></svg>`;
          
          try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=tr&dt=t&q=${encodeURIComponent(selectedText)}`;
            const response = await fetch(url);
            const data = await response.json();
            
            let translated = '';
            if (data && data[0]) {
              data[0].forEach(segment => {
                if (segment[0]) translated += segment[0];
              });
            }
            
            if (translated) {
              showTranslationTooltip(rect, translated);
            }
          } catch (err) {
            console.error('[LowBrowser Selection Translate] Error fetching translation:', err);
          } finally {
            removeBubble();
          }
        });
        
        document.body.appendChild(bubble);
        activeBubble = bubble;
      }
    }
  });

  function showTranslationTooltip(rect, text) {
    removeTooltip();
    
    const tooltip = document.createElement('div');
    tooltip.className = 'lowbrowser-translate-tooltip';
    tooltip.innerHTML = `
      <div class="lowbrowser-translate-tooltip-header">
        <svg viewBox="0 0 24 24" style="width: 10px; height: 10px; fill: currentColor;"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>
        <span>TÜRKÇE ÇEVİRİ</span>
      </div>
      <div>${text}</div>
    `;
    
    // Position tooltip card below selection rect (or shift if clipping window bounds)
    const x = Math.max(10, Math.min(window.innerWidth - 300, rect.left + window.scrollX + (rect.width / 2) - 140));
    const y = rect.bottom + window.scrollY + 10;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    
    document.body.appendChild(tooltip);
    activeTooltip = tooltip;
  }

  function removeBubble() {
    if (activeBubble) {
      activeBubble.remove();
      activeBubble = null;
    }
  }

  function removeTooltip() {
    if (activeTooltip) {
      activeTooltip.remove();
      activeTooltip = null;
    }
  }

  function removeTranslateElements() {
    removeBubble();
    removeTooltip();
  }
});
