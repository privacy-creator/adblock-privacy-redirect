// === URL Filters ===
const youtubeFilters = ["*://*.youtube.com/*"];
const vpnFilters = [
    "*://*.youtube.com/*",
    "*://*.x.com/*",
    "*://*.instagram.com/*",
    "*://*.whatsapp.com/*",
];

// === Global Variables ===
let connectedToVPN = false;
let blockRequest;
let blockFilters = [];

const blockedCountsPerTab = {};
const blockedURLsPerTab = {};
const lastDomainPerTab = {};

// === Badge Handling ===
function updateBadgeText(tabId) {
    const count = blockedCountsPerTab[tabId] || "0";
    chrome.browserAction.setBadgeText({ text: count.toString(), tabId });
}

function incrementBlockedCount(tabId) {
    blockedCountsPerTab[tabId] = (blockedCountsPerTab[tabId] || 0) + 1;
    updateBadgeText(tabId);
}

function resetBlockedCount(tabId, reset) {
    if (reset) blockedCountsPerTab[tabId] = 0;
    updateBadgeText(tabId);
}

// === Blocked URLs Handling ===
function resetBlockedURLs(tabId, reset) {
    if (reset) blockedURLsPerTab[tabId] = [];
    const urlsToStore = blockedURLsPerTab[tabId] || [];
    chrome.storage.local.set({ blockedURLs: urlsToStore });
}

function storeBlockedURL(url, tabId) {
    if (!blockedURLsPerTab[tabId]) blockedURLsPerTab[tabId] = [];
    blockedURLsPerTab[tabId].push(url);
    chrome.storage.local.set({ blockedURLs: blockedURLsPerTab[tabId] });
    incrementBlockedCount(tabId);
}

// === YouTube Script Blocking ===
function ytBlockScriptsByName() {
    const scriptsToBlock = [
        "sw.js", "scheduler.js", "spf.js", "network.js", "www-tampering.js",
        "web-animations-next-lite.min.js", "offline.js", "remote.js", "endscreen.js",
        "inline_preview.js", "intersection-observer.min.js", "custom-elements-es5-adapter.js",
        "annotations_module.js", "miniplayer.js"
    ];

    chrome.webRequest.onBeforeRequest.addListener(
        details => {
            if (scriptsToBlock.some(script => details.url.includes(script))) {
                if (details.tabId !== -1) storeBlockedURL(details.url, details.tabId);
                return { cancel: true };
            }
        },
        { urls: youtubeFilters },
        ["blocking"]
    );
}

// === VPN Blocking ===
function checkVPNStatus() {
    fetch('https://ipv4.am.i.mullvad.net/json')
        .then(res => res.json())
        .then(data => connectedToVPN = !!data.mullvad_exit_ip)
        .catch(() => connectedToVPN = false);
}

function vpnBlockSite() {
    chrome.webRequest.onBeforeRequest.addListener(
        () => !connectedToVPN ? { cancel: true } : {},
        { urls: vpnFilters },
        ["blocking"]
    );
}

// === Replace Specific API Requests ===
function sunoHack() {
    chrome.webRequest.onBeforeRequest.addListener(
        () => {
            const redirectUrl = chrome.runtime.getURL("js/replaceJS/sunoPro.json");
            return { redirectUrl };
        },
        { urls: ["https://studio-api.prod.suno.com/api/billing/info/"] },
        ["blocking"]
    );
}

// === Ad and Tracker Blocking ===
function blockAdsAndTrackers() {
    if (blockFilters.length === 0) return;
    blockRequest = details => {
        if (details.tabId !== -1) storeBlockedURL(details.url, details.tabId);
        return { cancel: true };
    };
    chrome.webRequest.onBeforeRequest.addListener(
        blockRequest,
        { urls: blockFilters },
        ["blocking"]
    );
}

// === Load Filters from JSON ===
function getFiltersFromJson() {
    fetch(chrome.runtime.getURL("../json/blocklist.json"))
        .then(res => res.json())
        .then(data => {
            blockFilters = [];
            const keys = Object.keys(data);
            let pending = keys.length;

            keys.forEach(key => {
                chrome.storage.local.get([`${key}Filter`], result => {
                    if (result[`${key}Filter`]) {
                        blockFilters.push(...data[key].flat());
                    }
                    if (--pending === 0) setTimeout(blockAdsAndTrackers, 100);
                });
            });
        })
        .catch(error => console.error("Error loading filters:", error));
}

// === Storage Change Handler ===
function handleStorageChange() {
    if (blockRequest) {
        chrome.webRequest.onBeforeRequest.removeListener(blockRequest);
    }
    blockFilters = [];
    getFiltersFromJson();
}

// === Tab and Navigation Events ===
chrome.tabs.onRemoved.addListener(tabId => {
    delete blockedCountsPerTab[tabId];
    delete blockedURLsPerTab[tabId];
    delete lastDomainPerTab[tabId];
});

chrome.webNavigation.onCommitted.addListener(details => {
    const { tabId, transitionType } = details;

    if (["reload", "typed"].includes(transitionType)) {
        resetBlockedCount(tabId, true);
        resetBlockedURLs(tabId, true);
    } else if (["link", "auto_subframe"].includes(transitionType)) {
        chrome.tabs.get(tabId, tab => {
            const currentDomain = new URL(tab.url).hostname;
            if (lastDomainPerTab[tabId] && lastDomainPerTab[tabId] !== currentDomain) {
                resetBlockedCount(tabId, true);
                resetBlockedURLs(tabId, true);
            }
            lastDomainPerTab[tabId] = currentDomain;
        });
    }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
    resetBlockedCount(tabId, false);
    resetBlockedURLs(tabId, false);
});
