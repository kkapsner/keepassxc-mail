/* globals keepass, keepassClient, onDisconnected */
"use strict";

const page = {
	tabs: [],
	clearCredentials: () => {},
	clearAllLogins: () => {},
	settings: {
		autoReconnect: true,
		checkUpdateKeePassXC: 0
	}
};

const browserAction = {
	show: () => {},
	showDefault: () => {}
};

// enable access to keepass object in option page
window.keepass = keepass;
const isKeepassReady = function(){
	const keepassModule = import("./modules/keepass.js");
	return async function(){
		const { isReady } = await keepassModule;
		return isReady();
	};
}();
window.isKeepassReady = isKeepassReady;

import("./modules/externalRequests.js");

window.selectedModule = import("./modules/selected.js");

const getCredentialsModule = import("./modules/getCredentials.js");
browser.credentials.onCredentialRequested.addListener(async function(credentialInfo){
	const { getCredentials } = await getCredentialsModule;
	return await getCredentials(credentialInfo);
});


const storeCredentialsModule = import("./modules/storeCredentials.js");
browser.credentials.onNewCredential.addListener(async function(credentialInfo){
	const { storeCredentials } = await storeCredentialsModule;
	return await storeCredentials(credentialInfo);
});

browser.credentials.getThunderbirdSavedLoginsStatus().then(async function(status){
	if (status.count === 0){
		return false;
	}
	const currentSeenPasswordChange = Math.max(status.latestTimeCreated, status.latestTimePasswordChanged);
	const { lastSeenPasswordChange } = await browser.storage.local.get({lastSeenPasswordChange: -1});
	browser.storage.local.set({lastSeenPasswordChange: currentSeenPasswordChange});
	if (lastSeenPasswordChange >= currentSeenPasswordChange){
		return false;
	}
	(await import("./modules/modal.js")).messageModal(
		browser.i18n.getMessage("passwordsStoredInThunderbird.title"),
		lastSeenPasswordChange === -1?
			browser.i18n.getMessage("passwordsStoredInThunderbird.message"):
			browser.i18n.getMessage("passwordsStoredInThunderbird.newStored"),
		"passwordsStoredInThunderbird"
	);
	return true;
}).catch(error => {});
