/* TAB EVENTS */
// For most tab events, we simply resave the entire window.
// While more wasteful, this makes the code much more robust.

function onTabAttached(tabId, info) {
    onTabChanged(tabId, info.newWindowId);
    // TODO: handle the case where this was the last tab of a saved window
}
chrome.tabs.onAttached.addListener(onTabAttached);


function onTabCreated(tab) {
    onTabChanged(tab.id, tab.windowId);
}
chrome.tabs.onCreated.addListener(onTabCreated);


function onTabDetached(tabId, info) {
    if (tabIdToSavedWindowId[tabId]) {
        delete tabIdToSavedWindowId[tabId];
    }
    onTabChanged(tabId, info.oldWindowId);
}
chrome.tabs.onDetached.addListener(onTabDetached);


function onTabMoved(tabId, info) {
    onTabChanged(tabId, info.windowId);
}
chrome.tabs.onMoved.addListener(onTabMoved);


function onTabRemoved(tabId, removeInfo) {
    var windowId = tabIdToSavedWindowId[tabId];
    delete tabIdToSavedWindowId[tabId];
    isWindowClosing[windowId] = removeInfo.isWindowClosing;
    onTabChanged(tabId, windowId);
}
chrome.tabs.onRemoved.addListener(onTabRemoved);


function onTabSelectionChanged(tabId, info) {
    var windowId = info.windowId;
    updateBadgeForTab({id: tabId, windowId: windowId});
    onTabChanged(tabId, windowId);
}
chrome.tabs.onSelectionChanged.addListener(onTabSelectionChanged);


function onTabUpdated(tabId, info, tab) {
    onTabChanged(tabId, tab.windowId);
}
chrome.tabs.onUpdated.addListener(onTabUpdated);


/*
 *
 */

var updates = {};

// throttle updates
function onTabChanged(tabId, windowId) {

    if ( ! updates[windowId] ) {
        updates[windowId] = _throttle( function() { update(windowId); }, 10000, {leading: false});
    }

    updates[windowId]();
}

// updates a window in response to a tab event
function update(windowId) {


    if (isWindowClosing[windowId]) {
        return;
    }

    getPopulatedWindow(windowId, function(browserWindow) {

        // if the window is saved, we update it
        if (windowIdToName[windowId]) {

            for ( var i in browserWindow.tabs ) {

                tabIdToSavedWindowId[browserWindow.tabs[i].id] = windowId;

            }

            var name = windowIdToName[windowId];
            var displayName = sessions[name].displayName;
            saveSession(browserWindow, name, displayName);

        } else {

            // otherwise we double check that it's not saved
            for (i in closedWindows) {
                var savedWindow = closedWindows[i];
                if (windowsAreEqual(browserWindow, savedWindow)) {
                    var name = savedWindow.name;
                    var displayName = savedWindow.displayName;
                    saveSession(browserWindow, name, displayName);
                    markWindowAsOpen(browserWindow);
                }
            }

        }

        updateBadgeForWindow(windowId);

    });
}

/* WINDOW EVENTS */


function onWindowRemoved(windowId) {


    isWindowClosing[windowId] = true;
    var windowName = windowIdToName[windowId];

    if (windowName) {
        var savedWindow = sessions[windowName];
        markWindowAsClosed(savedWindow);
    }

    delete isWindowClosing[windowId];
}
chrome.windows.onRemoved.addListener(onWindowRemoved);



/* Helper methods */


// given a window id, fetches the corresponding window object
// and tabs, and calls callback with the window as argument
function getPopulatedWindow(windowId, callback) {

    if (!windowId) {return;}

    chrome.windows.get(windowId, function(browserWindow) {

        if ( chrome.runtime.lastError ) {
            console.error(chrome.runtime.lastError.message);
        }

        if (!browserWindow) {return;}

        chrome.tabs.getAllInWindow(windowId, function(tabs) {
            if (!tabs) {return;}
            browserWindow.tabs = tabs;
            callback(browserWindow);
        });

    });
}


// _underscore throttle
function _throttle(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
        previous = options.leading === false ? 0 : Date.now();
        timeout = null;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
    };
    return function() {
        var now = Date.now();
        if (!previous && options.leading === false) previous = now;
        var remaining = wait - (now - previous);
        context = this;
        args = arguments;
        if (remaining <= 0 || remaining > wait) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            previous = now;
            result = func.apply(context, args);
            if (!timeout) context = args = null;
        } else if (!timeout && options.trailing !== false) {
            timeout = setTimeout(later, remaining);
        }
        return result;
    };
};
