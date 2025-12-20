/* globals keepass, keepassClient */
import { log } from "./log.js";
import { connect, disconnect } from "./nativeMessaging.js";
import { wait } from "./utils.js";
import { confirmModal, messageModal } from "./modal.js";

const k = keepass;
const kc = keepassClient;

export { k as keepass, kc as keepassClient };

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

export const isReady = (() => {
	async function initialize(){
		// load key ring - initially done in keepass.js but it fails sometimes...
		await loadKeyRing();
		await keepass.migrateKeyRing();
		await connect();
		await keepass.enableAutomaticReconnect();
		await keepass.associate();
		if (keepass.isDatabaseClosed){
			await unlockDatabase();
		}
		// check key ring storage - initially done in keepass.js but it fails sometimes...
		checkKeyRingStorage();
		
		return {connect, disconnect};
	}
	let keepassReady = initialize();
	keepassReady.catch((error) => log("Initialization failed:", error));
	return async function(){
		try {
			return await keepassReady;
		}
		catch (error){
			keepassReady = initialize();
			keepassReady.catch((error) => log("Initialization failed:", error));
			return await keepassReady;
		}
	};
})();

let currentUnlockAttempt = undefined;
async function unlockDatabase(){
	try {
		log("Database is locked -> ask to open");
		if (!await confirmModal(
			browser.i18n.getMessage("unlockDatabase.title"),
			browser.i18n.getMessage("unlockDatabase.question")
		)){
			throw "user declined";
		}
		log("try to unlock");
		await keepass.testAssociation(undefined, [true, true]);
		// check for one minute every second
		// automatic reconnect handles the connection
		for (let i = 0; i < 1 * 60; i += 1){
			await wait(1000);
			if (!keepass.isDatabaseClosed){
				break;
			}
		}
		if (keepass.isDatabaseClosed){
			await messageModal(
				browser.i18n.getMessage("unlockDatabase.title"),
				browser.i18n.getMessage("unlockDatabase.failed")
			);
			throw "unlock timeout";
		}
		log("Unlock successful");
		return true;
	}
	catch (error){
		log("Unlock not successful:", error);
		return false;
	}
	finally {
		currentUnlockAttempt = undefined;
	}
}
export async function handleLockedDatabase(){
	if (currentUnlockAttempt){
		log("Unlock attempt already running");
		return currentUnlockAttempt;
	}
	currentUnlockAttempt = unlockDatabase();
	return currentUnlockAttempt;
}