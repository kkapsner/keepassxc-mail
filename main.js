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

async function checkKeyRingStorage(){
	function objectsEqual(obj1, obj2){
		const keys1 = Object.keys(obj1);
		const keys2 = Object.keys(obj2);
		if (keys1.length !== keys2.length){
			return false;
		}
		return keys1.every(function(key){
			const value1 = obj1[key];
			const value2 = obj2[key];
			if ((typeof value1) !== (typeof value2)){
				return false;
			}
			if ((typeof value1) === "object"){
				return objectsEqual(value1, value2);
			}
			return value1 === value2;
		});
	}
	async function wait(ms){
		return new Promise(function(resolve){
			window.setTimeout(resolve, ms);
		});
	}
	// check if the key ring actually saved in the storage
	const databaseHashes = Object.keys(keepass.keyRing);
	if (databaseHashes.length){
		let storedKeyRing = (await browser.storage.local.get({keyRing: {}})).keyRing;
		while (!objectsEqual(keepass.keyRing, storedKeyRing)){
			await wait(500);
			console.log("Store key ring");
			try {
				await browser.storage.local.set({keyRing: keepass.keyRing});
				storedKeyRing = (await browser.storage.local.get({keyRing: {}})).keyRing;
			}
			catch (e){
				console.log("storing key ring failed:", e);
			}
		}
	}
}

// enable access to keepass object in option page
window.keepass = keepass;
const keepassReady = (async () => {
	try {
		await keepass.migrateKeyRing();
		await keepass.reconnect(null, 5000); // 5 second timeout for the first connect
		await keepass.enableAutomaticReconnect();
		await keepass.associate();
		checkKeyRingStorage();
	}
	catch (e) {
		console.log("init failed", e);
	}
})();



[
	"pickedEntry", "entryLabel", "entryTooltip",
	"loadingPasswords", "noPasswordsFound", "retry", "credentialInfo"
].forEach(function(stringName){
	browser.credentials.setTranslation(stringName, browser.i18n.getMessage(stringName));
});

const lastRequest = {};
browser.credentials.onCredentialRequested.addListener(async function(credentialInfo){
	console.log("got credential request:", credentialInfo);
	await keepassReady;
	const presentIds = new Map();
	const credentialsForHost = (await keepass.retrieveCredentials(false, [credentialInfo.host, credentialInfo.host]))
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

browser.credentials.onNewCredential.addListener(async function(credentialInfo){
	let saveNewCredentials = (await browser.storage.local.get({saveNewCredentials: true})).saveNewCredentials;
	if (saveNewCredentials){
		const group = await keepass.createNewGroup(null, ["KeePassXC-Mail Passwords"]);
		keepass.addCredentials(null,
			[credentialInfo.login, credentialInfo.password, credentialInfo.host, group.name, group.uuid]
		);
	}
});