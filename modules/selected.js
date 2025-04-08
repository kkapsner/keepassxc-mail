import { log } from "./log.js";

export const selectedEntries = new Map();
const storeAtEntries = new Map();
export async function clearSelectedEntries(){
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

export function getSelectedEntryUuid(id, entries){
	if (selectedEntries.has(id)){
		const cached = selectedEntries.get(id);
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
			log("Use last selected entry for", id);
			return cached.uuid;
		}
	}
	return undefined;
}

export async function setSelectedEntry(id, uuid, doNotAskAgain){
	selectedEntries.set(id, {uuid: uuid, doNotAskAgain, timestamp: Date.now()});
	if (doNotAskAgain){
		await browser.storage.local.get({selectedEntries: []}).then(async function({selectedEntries}){
			let found = false;
			for (let i = 0; i < selectedEntries.length; i += 1){
				if (selectedEntries[i].host === id){
					selectedEntries[i].uuid = uuid;
					found = true;
				}
			}
			if (!found){
				selectedEntries.push({host: id, uuid: uuid});
			}
			await browser.storage.local.set({selectedEntries});
			return undefined;
		}).catch(error => console.error(error));
	}
}

export function getStoreAtEntry(id, entries){
	if (storeAtEntries.has(id)){
		const stored = storeAtEntries.get(id);
		if (
			!stored.save ||
			entries.some(e => e.uuid === stored.uuid)
		){
			log("Use last store at entry for", id);
			return stored;
		}
	}
	return undefined;
}

export async function setStoreAtEntry(id, uuid, save, doNotAskAgain){
	if (doNotAskAgain){
		storeAtEntries.set(id, {save, uuid, doNotAskAgain});
		
		await browser.storage.local.get({storeAtEntries: []}).then(async function({storeAtEntries}){
			let found = false;
			for (let i = 0; i < storeAtEntries.length; i += 1){
				if (storeAtEntries[i].host === id){
					storeAtEntries[i].save = save;
					storeAtEntries[i].uuid = uuid;
					found = true;
				}
			}
			if (!found){
				storeAtEntries.push({host: id, uuid, save});
			}
			await browser.storage.local.set({storeAtEntries});
			return undefined;
		}).catch(error => console.error(error));
	}
}