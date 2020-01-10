/* globals keepass */
const page = {
	tabs: [],
	clearCredentials: () => {"use strict";},
	settings: {
		autoReconnect: true,
		checkUpdateKeePassXC: 0
	}
};

const browserAction = {
	show: () => {"use strict";},
	showDefault: () => {"use strict";}
};

keepass.nativeHostName = "de.kkapsner.keepassxc_mail";

// enable access to keepass object in option page
window.keepass = keepass;
const keepassReady = (async () => {
	"use strict";
	
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
	"use strict";
	
	browser.keepassxc.setTranslation(stringName, browser.i18n.getMessage(stringName));
});

const lastRequest = {};
browser.keepassxc.onCredentialRequested.addListener(async function(credentialInfo){
	"use strict";
	await keepassReady;
	let credentialsForHost = await keepass.retrieveCredentials(false, [credentialInfo.host]);
	if (credentialInfo.login){
		credentialsForHost = credentialsForHost.filter(function(credential){
			return credential.login === credentialInfo.login;
		});
	}
	else {
		credentialsForHost = credentialsForHost.filter(function(credential){
			return credential.login;
		});
	}
	
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