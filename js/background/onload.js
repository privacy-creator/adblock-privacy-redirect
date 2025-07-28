window.onload = function () {
    getFiltersFromJson()
    // ytBlockScriptsByName()

    // checkVPNStatus()
    // setInterval(checkVPNStatus, 10 * 1000)

    // sunoHack()

    // vpnBlockSite()

    loadRedirectSettings()
    youtubeRedirectFunc()
    youtubeShortToVideoFunc()
    googleRedirectFunc()
    twitterRedirectFunc()

    // todo: make it toggleable
    replaceFonts()
    replaceScripts()

// Listen for changes in the storage
    chrome.storage.onChanged.addListener((changes, namespace) => {
        for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
            if (key.includes("Filter")){
                handleStorageChange()
            } else {
                loadRedirectSettings()
            }
        }
    });
}