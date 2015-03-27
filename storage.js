

function SessionStorage() { }

// helper function to restore from localSessionStorage
SessionStorage.restoreFromLocalStorage = function (key, defaultValue) {
    if (localStorage[key]) {
        return JSON.parse(localStorage[key]);
    } else {
        localStorage[key] = JSON.stringify(defaultValue);
        return defaultValue;
    }
}


SessionStorage.get = function(key, callback) {

    chrome.storage.sync.get(key, callback);

};

SessionStorage.store = function(key, value, callback) {

    if ( typeof callback !== 'function') {

        callback = function() {
            console.log( 'Updated %s', key);
        }

    }

    var store = {};
    store[key] = value;

    chrome.storage.sync.set(store, callback);

}

SessionStorage.remove = function(key, callback) {

    if ( typeof callback !== 'function') {

        callback = function() {
            console.log( 'Removed %s', key);
        }

    }

    chrome.storage.sync.remove(key, callback);

};


SessionStorage.onChanged = function(changes, namespace) {

    for (key in changes) {

        var storageChange = changes[key];

        if ( changes[key].newValue == undefined ) {

            deleteSession(key);

        } else {

            if ( ! sessions[key] || closedWindows[key] || ! windowsAreEqual(storageChange.newValue, sessions[key])) {

                delete storageChange.newValue.id;

                if ( ! sessions[key] ) {
                    sessions[key] = storageChange.newValue;
                }

                markWindowAsClosed(sessions[key]);

                sessions[key] = storageChange.newValue;

            }

        }


    }
};

chrome.storage.onChanged.addListener(SessionStorage.onChanged);
