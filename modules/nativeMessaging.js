/* globals keepassClient, keepass, onDisconnected */
import { log } from "./log.js";

keepassClient.nativeHostName = "de.kkapsner.keepassxc_mail";
export async function connect(forceOptionSearch){
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

export async function disconnect(){
	if (keepassClient.nativePort){
		await keepassClient.nativePort.disconnect();
		onDisconnected();
	}
}