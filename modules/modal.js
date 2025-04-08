import { setSelectedEntry, getSelectedEntryUuid, setStoreAtEntry, getStoreAtEntry } from "./selected.js";

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

export async function messageModal(title, text){
	return await openModal({
		path: "modal/message/index.html",
		message: {
			title,
			text
		},
		defaultReturnValue: undefined
	});
}

export async function confirmModal(title, question){
	return await openModal({
		path: "modal/confirm/index.html",
		message: {
			title,
			question
		},
		defaultReturnValue: false
	});
}

export async function choiceModal(host, login, entries){
	const cachedId = login? `${login}@${host}`: host;
	const cachedUuid = getSelectedEntryUuid(cachedId, entries);
	if (cachedUuid !== undefined){
		return cachedUuid;
	}
	const {selectedUuid, doNotAskAgain} = (entries.length === 1 && entries[0].autoSubmit)?
		{selectedUuid: entries[0].uuid, doNotAskAgain: false}:
		await openModal({
			path: "modal/choice/index.html",
			message: {
				host,
				login,
				entries
			},
			defaultReturnValue: {selectedUuid: undefined, doNotAskAgain: false}
		});
	
	if (selectedUuid !== undefined){
		setSelectedEntry(cachedId, selectedUuid, doNotAskAgain);
	}
	return selectedUuid;
}


export async function savingPasswordModal(host, login, entries){
	const storeId = login? `${login}@${host}`: host;
	const stored = getStoreAtEntry(storeId, entries);
	if (stored !== undefined){
		return stored;
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
	if (uuid !== undefined){
		setStoreAtEntry(storeId, uuid, save, doNotAskAgain);
	}
	
	return {save, uuid, doNotAskAgain};
}