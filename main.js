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
