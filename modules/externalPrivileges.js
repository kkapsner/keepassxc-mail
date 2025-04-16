import { log } from "./log.js";
let blocker = null;

export async function getPrivileges(extensionId){
	await blocker;
	const storage = await browser.storage.local.get({"privileges": {}});
	const p = storage.privileges[extensionId] || {request: undefined, store: undefined};
	return p;
}

async function nonBlockingSetPrivileges(extensionId, type, value){
	log("Setting privilege", type, "for", extensionId, "to", value);
	
	const storage = await browser.storage.local.get({"privileges": {}});
	const p = storage.privileges[extensionId] || {request: undefined, store: undefined};
	p[type] = value;
	storage.privileges[extensionId] = p;
	await browser.storage.local.set(storage);
}

export async function setPrivileges(extensionId, type, value){
	await blocker;
	const ownBlocker = nonBlockingSetPrivileges(extensionId, type, value);
	blocker = ownBlocker;
	return ownBlocker;
}