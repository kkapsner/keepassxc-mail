/* globals keepass */
"use strict";

const page = {
	tabs: [],
	clearCredentials: () => {},
	settings: {
		autoReconnect: true,
		checkUpdateKeePassXC: 0
	}
};

const browserAction = {
	show: () => {},
	showDefault: () => {}
};

keepass.nativeHostName = "de.kkapsner.keepassxc_mail";

// enable access to keepass object in option page
window.keepass = keepass;
const keepassReady = (async () => {
	try {
		await keepass.migrateKeyRing();
		await keepass.reconnect(null, 5000); // 5 second timeout for the first connect
		await keepass.enableAutomaticReconnect();
		await keepass.associate();
	}
	catch (e) {
		console.log("init failed", e);
	}
})();



[
	"pickedEntry", "entryLabel", "entryTooltip",
	"loadingPasswords", "noPasswordsFound", "retry"
].forEach(function(stringName){
	browser.credentials.setTranslation(stringName, browser.i18n.getMessage(stringName));
});

const lastRequest = {};
browser.credentials.onCredentialRequested.addListener(async function(credentialInfo){
	await keepassReady;
	const presentIds = new Map();
	const credentialsForHost = (await keepass.retrieveCredentials(false, [credentialInfo.host]))
		.filter(function(credentials){
			const alreadyPresent = presentIds.has(credentials.uuid);
			if (alreadyPresent){
				return false;
			}
			presentIds.set(credentials.uuid, true);
			return true;
		})
		.filter(function(credential){
			return credentialInfo.login? credential.login === credentialInfo.login: credential.login;
		}).map(function(credential){
			credential.skipAutoSubmit = credential.skipAutoSubmit === "true";
			return credential;
		});
	
	let autoSubmit = (await browser.storage.local.get({autoSubmit: false})).autoSubmit;
	if (autoSubmit){
		const requestId = credentialInfo.login + "|" + credentialInfo.host;
		const now = Date.now();
		if (now - lastRequest[requestId] < 1000){
			autoSubmit = false;
		}
		lastRequest[requestId] = now;
	}
	
	return {
		autoSubmit,
		credentials: credentialsForHost
	};
});