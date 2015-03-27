/*

The background page is responsible for the following:
* keeping track of the saved state, as well as what's open.
* retrieving, storing and updating this state in localSessionStorage.
* listening for window/tab events to keep our state up to date.
* saving, opening and deleting windows actions from the popups.

FEATURE: omnibox support

*/

var DEFAULT_NAME = "Session";

/* BASIC STATE */


// saved windows, keyed by name
// If the savedWindow has an id, it is currently open.
// Each savedWindow can only correspond to one open window at any given time.
//var savedWindows = {};

// map the ids of open windows to saved window names
// used to respond to events
var windowIdToName = {};

/* EDGE CASES */
// saved windows that aren't currently open, keyed by name
// used to match new windows to saved windows that are still closed
var closedWindows = {};

// Unfortunately, removing a tab doesn't give us a windowId
// so we need to keep track of that mapping.
var tabIdToSavedWindowId = {};

// object that stores per-window flags as to whether API indicated
// window-closing intention on tab removal
var isWindowClosing = {};

var sessions = {};


init(function() { console.log('loaded', sessions)});

function init( callback ) {

    getSessions( function() {
        matchOpenSessions( callback );
    });


}


/*
 * Get window/tabs data for all session names
 */
function getSessions(callback) {

    // get all sessions
    SessionStorage.get(null, function(data) {

        window.sessions = data;

        // mark as closed
        for ( var s in sessions ) {

            delete sessions[s].id;
            closedWindows[s] = sessions[s];

        }

        callback();

    });



}


/*
 * Check all open windows if they match a stored session
 */
function matchOpenSessions(callback) {

    chrome.windows.getAll({ populate: true }, function(windows) {

        for (var w in windows) {

            for ( var s in sessions ) {

                if (sessions[s].id) {
                    // already matched
                    break;
                }

                if ( windowsAreEqual(windows[w], sessions[s]) ) {

                    //storeWindow(browserWindow, name, savedWindow.displayName);
                    sessions[s].id = windows[w].id;
                    markWindowAsOpen(sessions[s]);
                    break;

                }

            }
        }

        callback();

    });

}


/*
 * Simple (asynchronous) function looper
 */
function asyncIterator(o) {

    var i = -1;

    var loop = function(){
        i++;
        if( i == o.length ){
			o.callback();
			return;
		}
        o.functionToLoop(loop, i);
    };

    loop();//init

}


// compares a current window to a saved window
// we are optimistic here: as long as the tabs of the new window
// match those of the saved window, we consider them equal
// even if the new window has more tabs
// TODO: try disregarding query strings (might be better?)
function windowsAreEqual(browserWindow, session) {

    if (browserWindow.incognito) {
        return false;
    }

    if (!browserWindow.tabs || !session.tabs) {
        return false;
    }

    if (browserWindow.tabs.length !== session.tabs.length) {
        return false;
    }

    // check all tab urls
    for (var t in session.tabs) {

        if (browserWindow.tabs[t].url != session.tabs[t].url) {
            return false;
        }

    }

    return true;

}

// save a window
// returns the saved window object
function createSession(browserWindow, displayName) {

    var displayName = (displayName == "") ? DEFAULT_NAME : displayName;

    // create unique display name
    var name = displayName;
    var n = 0;
    while(sessions[name]) {
        name = displayName + n;
        n++;
    }

    // add window to indexes
    //sessionNames.push(name);
    //SessionStorage.store('sessionNames', sessionNames);

    var session = saveSession(browserWindow, name, displayName);
    markWindowAsOpen(session);

    return browserWindow;
}


// store a window object
// returns the stored window
function saveSession(browserWindow, name, displayName) {

    browserWindow.name = name;
    browserWindow.displayName = displayName;

    sessions[name] = browserWindow;

    SessionStorage.store(name, browserWindow);

    return sessions[name];

}


function markWindowAsOpen(savedWindow) {

    delete closedWindows[savedWindow.name];
    windowIdToName[savedWindow.id] = savedWindow.name;

    for (var i in savedWindow.tabs) {
        tabIdToSavedWindowId[savedWindow.tabs[i].id] = savedWindow.id;
    }

    updateBadgeForWindow(savedWindow.id);
}


function markWindowAsClosed(savedWindow) {

    if ( savedWindow.id ) {
        if ( ! isWindowClosing[savedWindow.id] ) {
            updateBadgeForWindow(savedWindow.id);
        }
        delete windowIdToName[savedWindow.id];
    }

    closedWindows[savedWindow.name] = savedWindow;

    delete savedWindow.id;

}


// restore a previously saved window
function openSession(name) {

    chrome.tabs.getSelected(null, function(tab){

        // if the window was opened from a new tab, close the new tab
        if (tab.url == "chrome://newtab/") {
            chrome.tabs.remove(tab.id);
        }

        // compile the raw list of urls
        var session = sessions[name];
        var urls = [];

        for (var i in session.tabs) {
            urls[i] = session.tabs[i].url;
        }

        // create a window and open the tabs in it.
        var createData = {url: urls};

        var callback = function (browserWindow) {
            onSessionOpen(session, browserWindow);
        };

        chrome.windows.create(createData, callback);

    });

}


// mark a window as opened and pin tabs if necessary
function onSessionOpen(session, browserWindow) {

    session.id = browserWindow.id;
    markWindowAsOpen(session);

    // pinned tabs
    for (var i in session.tabs) {
        if (session.tabs[i].pinned) {
            chrome.tabs.update(browserWindow.tabs[i].id, {pinned: true});
        }
    }

}


function deleteSession(name) {

    var session = sessions[name];

    var id = session.id;

    if (id) {
        markWindowAsClosed(session);
        updateBadgeForWindow(id);
        for (var i in session.tabs) {
            delete tabIdToSavedWindowId[session.tabs[i].id];
        }
    }

    delete closedWindows[name];
    delete sessions[name];


    //sessionNames.splice(sessionNames.indexOf(name), 1);
    //SessionStorage.store('sessionNames', sessionNames);

}
