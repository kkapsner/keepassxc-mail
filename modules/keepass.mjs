/* globals keepass, keepassClient */
import { log } from "./log.mjs";
import { connect, disconnect } from "./nativeMessaging.mjs";
import { wait } from "./utils.mjs";

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