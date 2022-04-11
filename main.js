/* globals keepass */
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

keepass.nativeHostName = "de.kkapsner.keepassxc_mail";
async function connect(){
	const options = ["de.kkapsner.keepassxc_mail", "org.keepassxc.keepassxc_mail", "org.keepassxc.keepassxc_browser"];
	for (let index = 0; index < options.length; index += 1){
		keepass.nativeHostName = options[index];
		console.log("Try native application", keepass.nativeHostName);
		if (await keepass.reconnect(null, 5000)){ // 5 second timeout for the first connect
			return true;
		}
	}
	throw "Unable to connect to native messaging";
}

async function wait(ms){
	return new Promise(function(resolve){
		window.setTimeout(resolve, ms);
	});
}

async function loadKeyRing(){
	let loadCount = 0;
	let lastLoadError = null;
	while (!keepass.keyRing){
		await wait(50);
		loadCount += 1;
		try {
			const item = await browser.storage.local.get({
				latestKeePassXC: {
					version: "",
					lastChecked: null
				},
				keyRing: {}
			});
			keepass.latestKeePassXC = item.latestKeePassXC;
			keepass.keyRing = item.keyRing || {};
		}
		catch (error){
			lastLoadError = error;
		}
	}
	if (lastLoadError){
		console.log("Loaded key ring", loadCount, "times", lastLoadError);
	}
}

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
		// load key ring - initially done in keepass.js but it fails sometimes...
		await loadKeyRing();
		await keepass.migrateKeyRing();
		await connect();
		await keepass.enableAutomaticReconnect();
		await keepass.associate();
		// check key ring storage - initially done in keepass.js but it fails sometimes...
		checkKeyRingStorage();
	}
	catch (e){
		console.error("init failed", e);
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
			return (credentialInfo.login || !credentialInfo.loginChangeable)?
				credential.login === credentialInfo.login || credentialInfo.login === true:
				credential.login;
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

async function savingPasswordModal(host, login){
	const window = await browser.windows.create({
		url: browser.runtime.getURL("modal/savingPassword/index.html"),
		allowScriptsToClose: true,
		height: 100,
		width: 600,
		type: "detached_panel"
	});
	const message = {
		type: "start",
		host,
		login
	};
	
	// wait a little bit for the modal dialog to load
	await new Promise(function(resolve){setTimeout(resolve, 10);});
	try {
		try{
			return await browser.tabs.sendMessage(window.tabs[0].id, message);
		}
		catch (error){
			// first sendMessage might fail to timing issue
			return await browser.tabs.sendMessage(window.tabs[0].id, message);
		}
	}
	catch (error){
		return false;
	}
}

browser.runtime.onMessage.addListener(function(message, tab){
	if (message.action === "resize"){
		browser.windows.update(tab.tab.windowId, {
			width: message.width,
			height: message.height
		});
	}
});

browser.credentials.onNewCredential.addListener(async function(credentialInfo){
	const {saveNewCredentials, autoSaveNewCredentials} = (await browser.storage.local.get({
		saveNewCredentials: true,
		autoSaveNewCredentials: false
	}));
	if (saveNewCredentials){
		await keepassReady;
		if (!(await keepass.retrieveCredentials(false, [credentialInfo.host, credentialInfo.host]))
			.some(function(credential){
				return credential.login === credentialInfo.login || credentialInfo.login === true;
			})
		){
			if (
				autoSaveNewCredentials ||
				await savingPasswordModal(credentialInfo.host, credentialInfo.login)
			){
				const group = await keepass.createNewGroup(null, ["KeePassXC-Mail Passwords"]);
				keepass.addCredentials(null,
					[credentialInfo.login, credentialInfo.password, credentialInfo.host, group.name, group.uuid]
				);
				return true;
			}
		}
	}
	return false;
});
