const DEFAULT_SEARCH_ENGINES = {
    google: {
        url: 'https://www.google.com/search?q={query}',
        name: 'Google',
        isDefault: true
    },
    catsearch: {
        url: 'https://www.google.com/search?q={query}&source=catsearch',
        name: 'CatSearch',
        isDefault: true
    }
};

const DEFAULT_ENGINE_ID = 'google';
const START_PAGE_URL = 'data:text/html;charset=UTF-8,' + encodeURIComponent(`
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cat Browser</title>
  <style>
    body{margin:0;background:#101216;color:#e8eaed;font-family:Segoe UI,Arial,sans-serif;display:grid;place-items:center;height:100vh}
    .wrap{text-align:center;padding:24px}
    .logo{width:92px;height:92px;border-radius:20px;background:linear-gradient(135deg,#ffb300,#ff6d00);display:grid;place-items:center;margin:0 auto 18px;font-weight:700}
    h1{margin:0 0 8px;font-size:34px}
    p{margin:0;color:#9aa0a6}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">CB</div>
    <h1>Cat Browser</h1>
    <p>Your browser. Your search.</p>
  </div>
</body>
</html>
`);

const STORAGE_KEYS = {
    settings: 'catBrowserSettings',
    searchHistory: 'catBrowserHistory',
    customEngines: 'catBrowserCustomEngines',
    favorites: 'catBrowserFavorites',
    downloads: 'catBrowserDownloads',
    darkThemeMigration: 'catBrowserDarkThemeMigrationV1',
    engineMigrationV2: 'catBrowserEngineMigrationV2'
};

let settings = {
    keepHistory: true,
    autoSuggest: true,
    defaultSearchEngine: DEFAULT_ENGINE_ID,
    theme: 'dark',
    historyLimit: 20
};

let customEngines = {};
let allEngines = { ...DEFAULT_SEARCH_ENGINES };
let searchHistory = [];
let favorites = [];
let downloads = [];
let editingEngineId = null;
let panelMode = 'search';

let tabs = [];
let activeTabId = null;
let tabCounter = 0;

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const luckyBtn = document.getElementById('luckyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const favoriteBtn = document.getElementById('favoriteBtn');
const searchEngineSelect = document.getElementById('searchEngine');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const overlay = document.getElementById('overlay');
const customEngineModal = document.getElementById('customEngineModal');
const closeCustomEngineBtn = document.getElementById('closeCustomEngineBtn');
const customEnginesList = document.getElementById('customEnginesList');
const historyPanel = document.getElementById('historyPanel');
const historyToggleBtn = document.getElementById('historyToggleBtn');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');
const downloadOverlay = document.getElementById('downloadOverlay');
const progressFill = document.querySelector('.progress-fill');
const progressText = document.querySelector('.progress-text');

const tabBar = document.getElementById('tabBar');
const newTabBtn = document.getElementById('newTabBtn');
const browserViews = document.getElementById('browserViews');

const backBtn = document.getElementById('backBtn');
const forwardBtn = document.getElementById('forwardBtn');
const reloadBtn = document.getElementById('reloadBtn');
const homeBtn = document.getElementById('homeBtn');
const addressInput = document.getElementById('addressInput');
const goBtn = document.getElementById('goBtn');

const panelTabs = {
    search: document.getElementById('searchHistoryTab'),
    downloads: document.getElementById('downloadHistoryTab'),
    favorites: document.getElementById('favoritesTab')
};

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadCustomEngines();
    loadSearchHistory();
    loadFavorites();
    loadDownloads();

    applyTheme();
    updateEnginesList();
    setupEventListeners();

    createTab(START_PAGE_URL, 'Home');
    updateHistoryDisplay();
    initAccountFlow();

    const logoImg = document.querySelector('.cat-logo-img');
    const logoFallback = document.querySelector('.cat-logo-fallback');
    if (logoImg && logoFallback) {
        logoImg.addEventListener('error', () => {
            logoImg.style.display = 'none';
            logoFallback.style.display = 'flex';
        });
    }

    searchInput.focus();
});

function setupEventListeners() {
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    luckyBtn.addEventListener('click', performLuckySearch);

    favoriteBtn.addEventListener('click', toggleCurrentPageFavorite);
    downloadBtn.addEventListener('click', saveCurrentPageAsDownload);

    clearHistoryBtn.addEventListener('click', clearCurrentPanelData);
    settingsBtn.addEventListener('click', openSettings);
    closeSettingsBtn.addEventListener('click', closeSettings);
    overlay.addEventListener('click', closeSettings);

    historyToggleBtn.addEventListener('click', toggleHistoryPanel);
    closeHistoryBtn.addEventListener('click', closeHistoryPanel);

    newTabBtn.addEventListener('click', () => createTab(START_PAGE_URL, 'New Tab'));

    backBtn.addEventListener('click', () => {
        const webview = getActiveWebview();
        if (webview && webview.canGoBack()) webview.goBack();
    });

    forwardBtn.addEventListener('click', () => {
        const webview = getActiveWebview();
        if (webview && webview.canGoForward()) webview.goForward();
    });

    reloadBtn.addEventListener('click', () => {
        const webview = getActiveWebview();
        if (webview) webview.reload();
    });

    homeBtn.addEventListener('click', () => navigateCurrentTab(START_PAGE_URL));

    goBtn.addEventListener('click', navigateFromAddressBar);
    addressInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') navigateFromAddressBar();
    });

    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('clearAllDataBtn').addEventListener('click', clearAllData);

    document.getElementById('addEngineBtn').addEventListener('click', openAddEngineModal);
    closeCustomEngineBtn.addEventListener('click', closeCustomEngineModal);
    document.getElementById('saveEngineBtn').addEventListener('click', saveCustomEngine);
    document.getElementById('cancelEngineBtn').addEventListener('click', closeCustomEngineModal);

    Object.entries(panelTabs).forEach(([key, tabBtn]) => {
        tabBtn.addEventListener('click', () => switchPanelMode(key));
    });

    const themeRadios = document.querySelectorAll('input[name="theme"]');
    themeRadios.forEach((radio) => {
        radio.addEventListener('change', (e) => {
            settings.theme = e.target.value;
            applyTheme();
        });
    });
}

function createTab(url = START_PAGE_URL, title = 'New Tab') {
    const id = `tab-${++tabCounter}`;
    const normalizedUrl = normalizeUrl(url);

    const webview = document.createElement('webview');
    webview.className = 'browser-frame';
    webview.dataset.tabId = id;
    webview.src = normalizedUrl;
    webview.setAttribute('allowpopups', 'true');
    webview.setAttribute('partition', `persist:${id}`);

    webview.addEventListener('did-navigate', (event) => onTabNavigated(id, event.url));
    webview.addEventListener('did-navigate-in-page', (event) => onTabNavigated(id, event.url));
    webview.addEventListener('page-title-updated', (event) => updateTabTitle(id, event.title));
    webview.addEventListener('did-stop-loading', () => syncAddressAndNavState());
    webview.addEventListener('dom-ready', () => syncAddressAndNavState());

    browserViews.appendChild(webview);

    tabs.push({
        id,
        title,
        url: normalizedUrl
    });

    activateTab(id);
    renderTabs();
}

function activateTab(tabId) {
    activeTabId = tabId;

    const webviews = browserViews.querySelectorAll('.browser-frame');
    webviews.forEach((webview) => {
        webview.classList.toggle('active', webview.dataset.tabId === tabId);
    });

    renderTabs();
    syncAddressAndNavState();
}

function closeTab(tabId) {
    if (tabs.length === 1) {
        navigateCurrentTab(START_PAGE_URL);
        return;
    }

    const tabIndex = tabs.findIndex((tab) => tab.id === tabId);
    if (tabIndex === -1) return;

    const webview = browserViews.querySelector(`[data-tab-id="${tabId}"]`);
    if (webview) webview.remove();

    tabs = tabs.filter((tab) => tab.id !== tabId);

    if (activeTabId === tabId) {
        const nextTab = tabs[Math.max(0, tabIndex - 1)] || tabs[0];
        activateTab(nextTab.id);
    }

    renderTabs();
}

function renderTabs() {
    tabBar.innerHTML = tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const safeTitle = escapeHtml(tab.title || 'New Tab');
        return `
            <div class="tab-item ${isActive ? 'active' : ''}" data-tab-id="${tab.id}" title="${safeTitle}">
                <span class="tab-title">${safeTitle}</span>
                <button class="tab-close" data-close-tab-id="${tab.id}" aria-label="Close tab">x</button>
            </div>
        `;
    }).join('');

    tabBar.querySelectorAll('.tab-item').forEach((item) => {
        item.addEventListener('click', (event) => {
            const closeId = event.target.dataset.closeTabId;
            if (closeId) return;
            activateTab(item.dataset.tabId);
        });
    });

    tabBar.querySelectorAll('.tab-close').forEach((closeBtn) => {
        closeBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            closeTab(closeBtn.dataset.closeTabId);
        });
    });
}

function onTabNavigated(tabId, url) {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    tab.url = url;

    if (!tab.title || tab.title === 'New Tab') {
        tab.title = getTitleFromUrl(url);
        renderTabs();
    }

    if (activeTabId === tabId) {
        syncAddressAndNavState();
    }
}

function updateTabTitle(tabId, title) {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || !title) return;

    tab.title = title.trim().slice(0, 60) || getTitleFromUrl(tab.url);

    if (activeTabId === tabId) {
        renderTabs();
    } else {
        const tabItem = tabBar.querySelector(`[data-tab-id="${tabId}"] .tab-title`);
        if (tabItem) tabItem.textContent = tab.title;
    }
}

function getActiveWebview() {
    return browserViews.querySelector(`[data-tab-id="${activeTabId}"]`);
}

function syncAddressAndNavState() {
    const webview = getActiveWebview();
    const activeTab = tabs.find((tab) => tab.id === activeTabId);

    if (!webview || !activeTab) {
        backBtn.disabled = true;
        forwardBtn.disabled = true;
        addressInput.value = '';
        return;
    }

    const currentUrl = webview.getURL() || activeTab.url || '';
    if (currentUrl) {
        activeTab.url = currentUrl;
        addressInput.value = currentUrl;
    }

    try {
        backBtn.disabled = !webview.canGoBack();
        forwardBtn.disabled = !webview.canGoForward();
    } catch (error) {
        backBtn.disabled = true;
        forwardBtn.disabled = true;
    }

    renderTabs();
    updateFavoriteButtonState();
}

function navigateCurrentTab(rawInput) {
    const webview = getActiveWebview();
    if (!webview) return;

    const targetUrl = normalizeUrl(rawInput);
    const activeTab = tabs.find((tab) => tab.id === activeTabId);

    if (activeTab) {
        activeTab.url = targetUrl;
        activeTab.title = getTitleFromUrl(targetUrl);
    }

    webview.loadURL(targetUrl);
    renderTabs();
}

function navigateFromAddressBar() {
    const value = addressInput.value.trim();
    if (!value) return;

    const resolved = resolveAddressInput(value);
    navigateCurrentTab(resolved);
}

function performSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        alert('Please enter a search query');
        return;
    }

    const engineId = searchEngineSelect.value;
    const engine = allEngines[engineId];

    if (!engine) {
        alert('Selected search engine not found');
        return;
    }

    const searchUrl = engine.url.replace('{query}', encodeURIComponent(query));

    if (settings.keepHistory) {
        addToSearchHistory(query, engineId, searchUrl);
    }

    navigateCurrentTab(searchUrl);
    searchInput.value = '';
    searchInput.focus();
}

function performLuckySearch() {
    const query = searchInput.value.trim();
    if (!query) {
        alert('Please enter a search query');
        return;
    }

    const quickUrl = buildSearchUrl(query);

    if (settings.keepHistory) {
        addToSearchHistory(query, settings.defaultSearchEngine, quickUrl);
    }

    navigateCurrentTab(quickUrl);
    searchInput.value = '';
    searchInput.focus();
}

function addToSearchHistory(query, engineId, url) {
    const engine = allEngines[engineId] || { name: 'Unknown' };

    searchHistory.unshift({
        query,
        engine: engineId,
        engineName: engine.name,
        url,
        timestamp: new Date().toISOString()
    });

    if (searchHistory.length > settings.historyLimit) {
        searchHistory = searchHistory.slice(0, settings.historyLimit);
    }

    saveSearchHistory();
    if (panelMode === 'search') updateHistoryDisplay();
}

function saveCurrentPageAsDownload() {
    showDownloadAnimation();
    const webview = getActiveWebview();
    if (!webview) return;

    const url = webview.getURL() || addressInput.value.trim();
    if (!url) {
        alert('Open a page first, then save it.');
        return;
    }

    const title = webview.getTitle() || getTitleFromUrl(url);

    downloads.unshift({
        title,
        url,
        timestamp: new Date().toISOString()
    });

    if (downloads.length > settings.historyLimit) {
        downloads = downloads.slice(0, settings.historyLimit);
    }

    saveDownloads();
    if (panelMode === 'downloads') updateHistoryDisplay();
    alert('Page saved to Downloads list.');
}

function showDownloadAnimation() {
    if (!downloadOverlay || !progressFill || !progressText) return;

    downloadOverlay.classList.remove('hidden');
    const duration = 5000;
    const start = performance.now();

    function tick(now) {
        const progress = Math.min(1, (now - start) / duration);
        const percent = Math.floor(progress * 100);
        progressFill.style.width = `${percent}%`;
        progressText.textContent = `${percent}%`;

        if (progress < 1) {
            requestAnimationFrame(tick);
        } else {
            setTimeout(() => downloadOverlay.classList.add('hidden'), 500);
        }
    }

    requestAnimationFrame(tick);
}

function toggleCurrentPageFavorite() {
    const webview = getActiveWebview();
    if (!webview) return;

    const url = webview.getURL();
    if (!url) {
        alert('Open a page first to add it to favorites.');
        return;
    }

    const existingIndex = favorites.findIndex((item) => item.url === url);

    if (existingIndex >= 0) {
        favorites.splice(existingIndex, 1);
    } else {
        favorites.unshift({
            title: webview.getTitle() || getTitleFromUrl(url),
            url,
            timestamp: new Date().toISOString()
        });

        if (favorites.length > settings.historyLimit) {
            favorites = favorites.slice(0, settings.historyLimit);
        }
    }

    saveFavorites();
    updateFavoriteButtonState();
    if (panelMode === 'favorites') updateHistoryDisplay();
}

function updateFavoriteButtonState() {
    const webview = getActiveWebview();
    if (!webview) return;

    const url = webview.getURL();
    const isFavorite = favorites.some((item) => item.url === url);

    favoriteBtn.classList.toggle('active', isFavorite);
    favoriteBtn.textContent = isFavorite ? 'Unstar' : 'Star';
}

function switchPanelMode(mode) {
    panelMode = mode;

    Object.entries(panelTabs).forEach(([key, button]) => {
        button.classList.toggle('active', key === mode);
    });

    updateHistoryDisplay();
}

function updateHistoryDisplay() {
    const data = panelMode === 'search'
        ? searchHistory
        : panelMode === 'downloads'
            ? downloads
            : favorites;

    if (!data.length) {
        historyList.innerHTML = '<p class="empty-history">No data yet</p>';
        return;
    }

    historyList.innerHTML = data.map((item, index) => {
        const time = formatTime(item.timestamp);
        const title = panelMode === 'search' ? item.query : item.title;
        const meta = panelMode === 'search'
            ? `${item.engineName || 'Unknown'} | ${time}`
            : `${getTitleFromUrl(item.url)} | ${time}`;

        return `
            <div class="history-item" onclick="openPanelItem(${index})">
                <div class="history-item-text">
                    <div>${escapeHtml(title || item.url)}</div>
                    <div class="history-item-engine">${escapeHtml(meta)}</div>
                </div>
                <button class="history-item-delete" onclick="deletePanelItem(event, ${index})" title="Delete">x</button>
            </div>
        `;
    }).join('');
}

function openPanelItem(index) {
    const list = panelMode === 'search'
        ? searchHistory
        : panelMode === 'downloads'
            ? downloads
            : favorites;

    const item = list[index];
    if (!item || !item.url) return;

    navigateCurrentTab(item.url);
}

function deletePanelItem(event, index) {
    event.stopPropagation();

    if (panelMode === 'search') {
        searchHistory.splice(index, 1);
        saveSearchHistory();
    } else if (panelMode === 'downloads') {
        downloads.splice(index, 1);
        saveDownloads();
    } else {
        favorites.splice(index, 1);
        saveFavorites();
    }

    updateHistoryDisplay();
    updateFavoriteButtonState();
}

window.openPanelItem = openPanelItem;
window.deletePanelItem = deletePanelItem;

function clearCurrentPanelData() {
    if (!confirm('Clear current list?')) return;

    if (panelMode === 'search') {
        searchHistory = [];
        saveSearchHistory();
    } else if (panelMode === 'downloads') {
        downloads = [];
        saveDownloads();
    } else {
        favorites = [];
        saveFavorites();
    }

    updateHistoryDisplay();
    updateFavoriteButtonState();
}

function formatTime(date) {
    const now = Date.now();
    const diff = now - new Date(date).getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return new Date(date).toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateEnginesList() {
    searchEngineSelect.innerHTML = '';

    Object.entries(customEngines).forEach(([id, engine]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = engine.name;
        searchEngineSelect.appendChild(option);
    });

    if (Object.keys(customEngines).length > 0) {
        const separator = document.createElement('option');
        separator.disabled = true;
        separator.textContent = '-----';
        searchEngineSelect.appendChild(separator);
    }

    Object.entries(DEFAULT_SEARCH_ENGINES).forEach(([id, engine]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = engine.name;
        searchEngineSelect.appendChild(option);
    });

    const preferredEngine = allEngines[settings.defaultSearchEngine]
        ? settings.defaultSearchEngine
        : DEFAULT_ENGINE_ID;

    searchEngineSelect.value = preferredEngine;
}

function openAddEngineModal() {
    editingEngineId = null;
    document.getElementById('engineName').value = '';
    document.getElementById('engineUrl').value = '';
    customEngineModal.classList.remove('hidden');
}

function editCustomEngine(engineId) {
    editingEngineId = engineId;
    const engine = customEngines[engineId];
    if (!engine) return;

    document.getElementById('engineName').value = engine.name;
    document.getElementById('engineUrl').value = engine.url;
    customEngineModal.classList.remove('hidden');
}

function closeCustomEngineModal() {
    customEngineModal.classList.add('hidden');
    editingEngineId = null;
    document.getElementById('engineName').value = '';
    document.getElementById('engineUrl').value = '';
}

function saveCustomEngine() {
    const name = document.getElementById('engineName').value.trim();
    const url = document.getElementById('engineUrl').value.trim();

    if (!name) {
        alert('Please enter an engine name');
        return;
    }

    if (!url || !url.includes('{query}')) {
        alert('Search URL must include {query}');
        return;
    }

    if (editingEngineId) {
        customEngines[editingEngineId] = { name, url };
    } else {
        const engineId = `custom_${Date.now()}`;
        customEngines[engineId] = { name, url };
    }

    saveCustomEngines();
    allEngines = { ...DEFAULT_SEARCH_ENGINES, ...customEngines };
    updateEnginesList();
    updateCustomEnginesList();
    closeCustomEngineModal();
}

function deleteCustomEngine(engineId) {
    if (!confirm('Delete this custom engine?')) return;

    delete customEngines[engineId];

    if (settings.defaultSearchEngine === engineId) {
        settings.defaultSearchEngine = DEFAULT_ENGINE_ID;
        localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    }

    saveCustomEngines();
    allEngines = { ...DEFAULT_SEARCH_ENGINES, ...customEngines };
    updateEnginesList();
    updateCustomEnginesList();
}

function updateCustomEnginesList() {
    if (!Object.keys(customEngines).length) {
        customEnginesList.innerHTML = '<p style="padding: 12px 0; font-size: 13px; color: #9aa0a6;">No custom engines yet</p>';
        return;
    }

    customEnginesList.innerHTML = Object.entries(customEngines).map(([id, engine]) => `
        <div class="engine-item">
            <div class="engine-item-info">
                <div class="engine-item-name">${escapeHtml(engine.name)}</div>
                <div class="engine-item-url">${escapeHtml(engine.url)}</div>
            </div>
            <div class="engine-item-actions">
                <button class="engine-edit-btn" onclick="editCustomEngine('${id}')">Edit</button>
                <button class="engine-delete-btn" onclick="deleteCustomEngine('${id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

window.editCustomEngine = editCustomEngine;
window.deleteCustomEngine = deleteCustomEngine;

function openSettings() {
    settingsModal.classList.remove('hidden');
    overlay.classList.remove('hidden');

    document.getElementById('keepHistory').checked = settings.keepHistory;
    document.getElementById('autoSuggest').checked = settings.autoSuggest;
    document.getElementById('historyLimit').value = settings.historyLimit;

    const defaultEngineSelect = document.getElementById('defaultSearchEngine');
    defaultEngineSelect.innerHTML = '';

    Object.entries(DEFAULT_SEARCH_ENGINES).forEach(([id, engine]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = engine.name;
        defaultEngineSelect.appendChild(option);
    });

    Object.entries(customEngines).forEach(([id, engine]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${engine.name} (Custom)`;
        defaultEngineSelect.appendChild(option);
    });

    defaultEngineSelect.value = allEngines[settings.defaultSearchEngine]
        ? settings.defaultSearchEngine
        : DEFAULT_ENGINE_ID;

    const themeRadio = document.querySelector(`input[name="theme"][value="${settings.theme}"]`);
    if (themeRadio) themeRadio.checked = true;

    updateCustomEnginesList();
}

function closeSettings() {
    settingsModal.classList.add('hidden');
    overlay.classList.add('hidden');
}

function toggleHistoryPanel() {
    historyPanel.classList.toggle('hidden');
    updateHistoryDisplay();
}

function closeHistoryPanel() {
    historyPanel.classList.add('hidden');
}

function initAccountFlow() {
    const accountModal = document.getElementById('accountModal');
    const accountForm = document.getElementById('accountForm');
    const skipBtn = document.getElementById('accountSkip');
    const stored = localStorage.getItem('catBrowserAccount');
    if (stored) return;

    accountModal.classList.remove('hidden');

    accountForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const email = document.getElementById('accountEmail').value.trim();
        const pass = document.getElementById('accountPassword').value.trim();
        if (!email || !pass) return;
        localStorage.setItem('catBrowserAccount', JSON.stringify({ email, mode: 'signed' }));
        accountModal.classList.add('hidden');
    });

    skipBtn.addEventListener('click', () => {
        localStorage.setItem('catBrowserAccount', JSON.stringify({ mode: 'guest' }));
        accountModal.classList.add('hidden');
    });
}

function saveSettings() {
    settings.keepHistory = document.getElementById('keepHistory').checked;
    settings.autoSuggest = document.getElementById('autoSuggest').checked;
    settings.defaultSearchEngine = document.getElementById('defaultSearchEngine').value;
    settings.historyLimit = parseInt(document.getElementById('historyLimit').value, 10) || 20;
    settings.theme = document.querySelector('input[name="theme"]:checked').value;

    searchHistory = searchHistory.slice(0, settings.historyLimit);
    favorites = favorites.slice(0, settings.historyLimit);
    downloads = downloads.slice(0, settings.historyLimit);

    saveSearchHistory();
    saveFavorites();
    saveDownloads();

    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));

    applyTheme();
    updateEnginesList();
    updateHistoryDisplay();

    alert('Settings saved successfully.');
    closeSettings();
}

function applyTheme() {
    document.body.classList.toggle('dark-mode', settings.theme === 'dark');
}

function loadSettings() {
    const saved = localStorage.getItem(STORAGE_KEYS.settings);
    if (saved) {
        settings = { ...settings, ...JSON.parse(saved) };
    }

    // Keep dark as the default for fresh or partial settings payloads.
    if (!settings.theme) {
        settings.theme = 'dark';
    }

    // Keep only available engines and default to Google for legacy installs.
    if (!allEngines[settings.defaultSearchEngine]) {
        settings.defaultSearchEngine = DEFAULT_ENGINE_ID;
    }

    // One-time migration: force stable default to Google so old CatSearch/DDG settings do not confuse startup.
    const engineMigrationDone = localStorage.getItem(STORAGE_KEYS.engineMigrationV2);
    if (!engineMigrationDone) {
        settings.defaultSearchEngine = 'google';
        localStorage.setItem(STORAGE_KEYS.engineMigrationV2, '1');
        localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    }

    // One-time migration for users from old light-only builds.
    const darkMigrationDone = localStorage.getItem(STORAGE_KEYS.darkThemeMigration);
    if (!darkMigrationDone) {
        settings.theme = 'dark';
        localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
        localStorage.setItem(STORAGE_KEYS.darkThemeMigration, '1');
    }
}

function saveSearchHistory() {
    localStorage.setItem(STORAGE_KEYS.searchHistory, JSON.stringify(searchHistory));
}

function loadSearchHistory() {
    const saved = localStorage.getItem(STORAGE_KEYS.searchHistory);
    if (saved) searchHistory = JSON.parse(saved);
}

function saveFavorites() {
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(favorites));
}

function loadFavorites() {
    const saved = localStorage.getItem(STORAGE_KEYS.favorites);
    if (saved) favorites = JSON.parse(saved);
}

function saveDownloads() {
    localStorage.setItem(STORAGE_KEYS.downloads, JSON.stringify(downloads));
}

function loadDownloads() {
    const saved = localStorage.getItem(STORAGE_KEYS.downloads);
    if (saved) downloads = JSON.parse(saved);
}

function saveCustomEngines() {
    localStorage.setItem(STORAGE_KEYS.customEngines, JSON.stringify(customEngines));
}

function loadCustomEngines() {
    const saved = localStorage.getItem(STORAGE_KEYS.customEngines);
    if (saved) {
        customEngines = JSON.parse(saved);
    }
    allEngines = { ...DEFAULT_SEARCH_ENGINES, ...customEngines };
}

function clearAllData() {
    if (!confirm('This will remove history, favorites, downloads, custom engines, and settings. Continue?')) return;

    localStorage.clear();

    searchHistory = [];
    favorites = [];
    downloads = [];
    customEngines = {};
    allEngines = { ...DEFAULT_SEARCH_ENGINES };

    settings = {
        keepHistory: true,
        autoSuggest: true,
        defaultSearchEngine: DEFAULT_ENGINE_ID,
        theme: 'dark',
        historyLimit: 20
    };

    localStorage.removeItem(STORAGE_KEYS.darkThemeMigration);

    applyTheme();
    updateEnginesList();
    switchPanelMode('search');
    updateCustomEnginesList();
    updateHistoryDisplay();
    navigateCurrentTab(START_PAGE_URL);

    closeSettings();
}

function normalizeUrl(rawInput) {
    const input = (rawInput || '').trim();
    if (!input) return START_PAGE_URL;

    if (/^(https?:|about:|file:|data:)/i.test(input)) return input;
    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(input)) return `https://${input}`;

    return buildSearchUrl(input);
}

function buildSearchUrl(query) {
    const engine = allEngines[searchEngineSelect.value] || DEFAULT_SEARCH_ENGINES[DEFAULT_ENGINE_ID];
    return engine.url.replace('{query}', encodeURIComponent(query));
}

function resolveAddressInput(value) {
    if (!value.includes(' ') && (/^(https?:|about:|file:|data:)/i.test(value) || /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value))) {
        return normalizeUrl(value);
    }
    return buildSearchUrl(value);
}

function getTitleFromUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname || 'New Tab';
    } catch (_error) {
        return 'New Tab';
    }
}


