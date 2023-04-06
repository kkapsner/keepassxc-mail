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

const log = function(){
	function f(d, n){
		const s = d.toString();
		return "0".repeat(n - s.length) + s;
	}
	return function log(...args){
		const now = new Date();
		console.log(
			`${f(now.getFullYear(), 4)}-${f(now.getMonth() + 1, 2)}-${f(now.getDate(), 2)} `+
			`${f(now.getHours(), 2)}:${f(now.getMinutes(), 2)}:` +
			`${f(now.getSeconds(), 2)}.${f(now.getMilliseconds(), 3)}:`,
			...args
		);
	};
}();

keepassClient.nativeHostName = "de.kkapsner.keepassxc_mail";
async function connect(forceOptionSearch){
	const savedNativeHostName = forceOptionSearch?
		false:
		(await browser.storage.local.get({nativeHostName: false})).nativeHostName;
	if (savedNativeHostName){
		keepassClient.nativeHostName = savedNativeHostName;
		log("Use saved native application", keepassClient.nativeHostName);
		if (await keepass.reconnect(null, 10000)){ // 10 second timeout for the first connect
			return true;
		}
	}
	else {
		const options = [
			"de.kkapsner.keepassxc_mail",
			"org.keepassxc.keepassxc_mail",
			"org.keepassxc.keepassxc_browser",
		];
		for (let index = 0; index < options.length; index += 1){
			keepassClient.nativeHostName = options[index];
			log("Try native application", keepassClient.nativeHostName);
			if (await keepass.reconnect(null, 10000)){ // 10 second timeout for the first connect
				browser.storage.local.set({nativeHostName: keepassClient.nativeHostName});
				return true;
			}
		}
	}
	throw "Unable to connect to native messaging";
}

async function disconnect(){
	if (keepassClient.nativePort){
		await keepassClient.nativePort.disconnect();
		onDisconnected();
	}
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
		log("Loaded key ring", loadCount, "times", lastLoadError);
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
			log("Store key ring");
			try {
				await browser.storage.local.set({keyRing: keepass.keyRing});
				storedKeyRing = (await browser.storage.local.get({keyRing: {}})).keyRing;
			}
			catch (e){
				log("storing key ring failed:", e);
			}
		}
	}
}

// enable access to keepass object in option page
window.keepass = keepass;
const isKeepassReady = (() => {
	async function initialize(){
		// load key ring - initially done in keepass.js but it fails sometimes...
		await loadKeyRing();
		await keepass.migrateKeyRing();
		await connect();
		await keepass.enableAutomaticReconnect();
		await keepass.associate();
		// check key ring storage - initially done in keepass.js but it fails sometimes...
		checkKeyRingStorage();
	}
	let keepassReady = initialize();
	keepassReady.catch((error) => log("Initialization failed:", error));
	return async function(){
		try {
			await keepassReady;
		}
		catch (error){
			keepassReady = initialize();
			keepassReady.catch((error) => log("Initialization failed:", error));
			await keepassReady;
		}
	};
})();

const waitForPort = (function(){
	const ports = new Map();
	const queue = new Map();
	function addQueue(tabId, callback){
		const queueEntry = (queue.get(tabId) || []);
		queueEntry.push(callback);
		queue.set(tabId, queueEntry);
	}
	function removeQueue(tabId, callback){
		const remaining = (queue.get(tabId) || []).filter(c => c !== callback);
		if (remaining.length){
			queue.set(tabId, remaining);
		}
		else {
			queue.delete(tabId);
		}
	}
	browser.runtime.onConnect.addListener(function(port){
		const tabId = port.sender.tab.id;
		ports.set(tabId, port);
		if(queue.has(tabId)){
			queue.get(tabId).forEach(function(callback){
				callback(port);
			});
			queue.delete(tabId);
		}
		port.onDisconnect.addListener(function(){
			ports.delete(tabId);
		});
	});
	return async function waitForPort(tabId, timeout = 1500){
		return new Promise(function(resolve, reject){
			if (ports.has(tabId)){
				resolve(ports.get(tabId));
				return;
			}
			addQueue(tabId, resolve);
			const timeoutId = window.setTimeout(function(){
				removeQueue(tabId, resolve);
				removeQueue(tabId, cancelTimeout);
				reject("Timeout");
			}, timeout);
			function cancelTimeout(){
				window.clearTimeout(timeoutId);
			}
			addQueue(tabId, cancelTimeout);
		});
	};
}());

async function openModal({path, message, defaultReturnValue}){
	function getPortResponse(port){
		return new Promise(function(resolve){
			function resolveDefault(){
				resolve(defaultReturnValue);
			}
			
			port.onDisconnect.addListener(resolveDefault);
			port.onMessage.addListener(function(data){
				if (data.type === "response"){
					resolve(data.value);
					port.onDisconnect.removeListener(resolveDefault);
				}
			});
			port.postMessage({
				type: "start",
				message
			});
		});
	}
	const window = await browser.windows.create({
		url: browser.runtime.getURL(path),
		allowScriptsToClose: true,
		height: 100,
		width: 600,
		type: "detached_panel"
	});
	try {
		const port = await waitForPort(window.tabs[0].id);
		return getPortResponse(port);
	}
	catch (error){
		return defaultReturnValue;
	}
}

const selectedEntries = new Map();
const storeAtEntries = new Map();
async function clearSelectedEntries(){
	selectedEntries.clear();
	storeAtEntries.clear();
	await browser.storage.local.set({selectedEntries: [], storeAtEntries: []});
}
browser.storage.local.get({selectedEntries: [], storeAtEntries: []}).then(function({
	selectedEntries: selectedEntriesStorage,
	storeAtEntries: storeAtEntriesStorage
}){
	selectedEntriesStorage.forEach(function(selectedEntry){
		selectedEntries.set(selectedEntry.host, {doNotAskAgain: true, uuid: selectedEntry.uuid});
	});
	storeAtEntriesStorage.forEach(function(storeAtEntry){
		storeAtEntries.set(storeAtEntry.host, {doNotAskAgain: true, save: storeAtEntry.save, uuid: storeAtEntry.uuid});
	});
	return undefined;
}).catch(()=>{});

async function choiceModal(host, login, entries){
	const cachedId = login? `${login}@${host}`: host;
	if (selectedEntries.has(cachedId)){
		const cached = selectedEntries.get(cachedId);
		if (
			(
				cached.doNotAskAgain ||
				Date.now() - cached.timestamp <= 60000
			) &&
			(
				cached.uuid === false ||
				entries.some(e => e.uuid === cached.uuid)
			)
		){
			log("Use last selected entry for", cachedId);
			return cached.uuid;
		}
	}
	const {selectedUuid, doNotAskAgain} = await openModal({
		path: "modal/choice/index.html",
		message: {
			host,
			login,
			entries
		},
		defaultReturnValue: {selectedUuid: undefined, doNotAskAgain: false}
	});
	
	if (selectedUuid !== undefined){
		selectedEntries.set(cachedId, {uuid: selectedUuid, doNotAskAgain, timestamp: Date.now()});
		if (doNotAskAgain){
			browser.storage.local.get({selectedEntries: []}).then(async function({selectedEntries}){
				let found = false;
				for (let i = 0; i < selectedEntries.length; i += 1){
					if (selectedEntries[i].host === cachedId){
						selectedEntries[i].uuid = selectedUuid;
						found = true;
					}
				}
				if (!found){
					selectedEntries.push({host: cachedId, uuid: selectedUuid});
				}
				await browser.storage.local.set({selectedEntries});
				return undefined;
			}).catch(error => console.error(error));
		}
	}
	return selectedUuid;
}

const lastRequest = {};
browser.credentials.onCredentialRequested.addListener(async function(credentialInfo){
	log("got credential request:", credentialInfo);
	await isKeepassReady();
	const presentIds = new Map();
	let credentialsForHost = (await keepass.retrieveCredentials(false, [credentialInfo.host, credentialInfo.host]))
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
				(
					credentialInfo.login === true ||
					credential.login.toLowerCase?.() === credentialInfo.login.toLowerCase?.()
				):
				credential.login;
		}).map(function(credential){
			credential.skipAutoSubmit = credential.skipAutoSubmit === "true";
			return credential;
		});
	log("keepassXC provided", credentialsForHost.length, "logins");
	let autoSubmit = (await browser.storage.local.get({autoSubmit: false})).autoSubmit;
	if (autoSubmit){
		const requestId = credentialInfo.login + "|" + credentialInfo.host;
		const now = Date.now();
		if (now - lastRequest[requestId] < 1000){
			autoSubmit = false;
		}
		lastRequest[requestId] = now;
	}
	
	if (
		credentialInfo.openChoiceDialog &&
		credentialsForHost.length &&
		(
			!autoSubmit ||
			credentialsForHost.length > 1 ||
			credentialsForHost[0]?.skipAutoSubmit
		)
	){
		const selectedUuid = await choiceModal(
			credentialInfo.host,
			credentialInfo.login,
			credentialsForHost.map(function (data){
				return {
					name: data.name,
					login: data.login,
					uuid: data.uuid,
					autoSubmit: autoSubmit && !data.skipAutoSubmit
				};
			})
		);
		const filteredCredentialsForHost = credentialsForHost.filter(e => e.uuid === selectedUuid);
		if (!selectedUuid || filteredCredentialsForHost.length){
			credentialsForHost = filteredCredentialsForHost;
		}
	}
	
	return {
		autoSubmit,
		credentials: credentialsForHost
	};
});

async function savingPasswordModal(host, login, entries){
	const storeId = login? `${login}@${host}`: host;
	if (storeAtEntries.has(storeId)){
		const stored = storeAtEntries.get(storeId);
		if (
			!stored.save ||
			entries.some(e => e.uuid === stored.uuid)
		){
			log("Use last store at entry for", storeId);
			return stored;
		}
	}
	const {save, uuid, doNotAskAgain} = await openModal({
		path: "modal/savingPassword/index.html",
		message: {
			host,
			login,
			entries,
		},
		defaultReturnValue: {save: false, uuid: undefined, doNotAskAgain: false}
	});
	if (doNotAskAgain){
		storeAtEntries.set(storeId, {save, uuid, doNotAskAgain});
		
		browser.storage.local.get({storeAtEntries: []}).then(async function({storeAtEntries}){
			let found = false;
			for (let i = 0; i < storeAtEntries.length; i += 1){
				if (storeAtEntries[i].host === storeId){
					storeAtEntries[i].save = save;
					storeAtEntries[i].uuid = uuid;
					found = true;
				}
			}
			if (!found){
				storeAtEntries.push({host: storeId, uuid, save});
			}
			await browser.storage.local.set({storeAtEntries});
			return undefined;
		}).catch(error => console.error(error));
	}
	
	return {save, uuid, doNotAskAgain};
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
	log("Got new password for", credentialInfo.login, "at", credentialInfo.host);
	const {saveNewCredentials, autoSaveNewCredentials} = (await browser.storage.local.get({
		saveNewCredentials: true,
		autoSaveNewCredentials: false
	}));
	if (saveNewCredentials){
		await isKeepassReady();
		const existingCredentials = (await keepass.retrieveCredentials(
			false,
			[credentialInfo.host, credentialInfo.host]
		)).filter(function (credential){
			return (
				true === credentialInfo.login ||
				credential.login.toLowerCase?.() === credentialInfo.login.toLowerCase?.()
			);
		});
		if (!existingCredentials.some(function(credential){
			return credential.password === credentialInfo.password;
		})){
			const cachedId = credentialInfo.login?
				`${credentialInfo.login}@${credentialInfo.host}`:
				credentialInfo.host;
			const cached = selectedEntries.get(cachedId) || null;
			const {save, uuid} = autoSaveNewCredentials?
				{save: true, uuid: cached?.uuid || null}:
				await savingPasswordModal(
					credentialInfo.host,
					credentialInfo.login,
					existingCredentials.map(function (data){
						return {
							name: data.name,
							login: data.login,
							uuid: data.uuid,
							preselected: data.uuid === cached?.uuid
						};
					})
				);
			if (save){
				log("Get or create password group");
				const group = await keepass.createNewGroup(null, ["KeePassXC-Mail Passwords"]);
				log("Saving password to database for", credentialInfo.login, "at", credentialInfo.host);
				log("Using uuid:", uuid);
				await keepass.updateCredentials(null,
					[uuid, credentialInfo.login, credentialInfo.password, credentialInfo.host, group.name, group.uuid]
				);
				log("Saving done");
				return true;
			}
		}
	}
	return false;
});
