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
const isKeepassReady = async function(){
	const { isReady } = await import("./modules/keepass.mjs");
	return isReady;
}();
window.isKeepassReady = isKeepassReady;


const getCredentialsModule = import("./modules/getCredentials.mjs");
browser.credentials.onCredentialRequested.addListener(async function(credentialInfo){
	const { getCredentials } = await getCredentialsModule;
	return await getCredentials(credentialInfo);
});


const storeCredentialsModule = import("./modules/storeCredentials.mjs");
browser.credentials.onNewCredential.addListener(async function(credentialInfo){
	const { storeCredentials } = await storeCredentialsModule;
	return await storeCredentials(credentialInfo);
});
