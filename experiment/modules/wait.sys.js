/* globals Services */
import { storeCredentials, requestCredentials } from "./credentials.sys.js";


export function waitForPromise(promise, defaultValue){
	let finished = false;
	let returnValue = defaultValue;
	promise.then(function(value){
		finished = true;
		returnValue = value;
		return returnValue;
	}).catch(function(){
		finished = true;
	});

	if (Services.tm.spinEventLoopUntilOrShutdown){
		Services.tm.spinEventLoopUntilOrShutdown(() => finished);
	}
	else if (Services.tm.spinEventLoopUntilOrQuit){
		Services.tm.spinEventLoopUntilOrQuit("keepassxc-mail:waitForPromise", () => finished);
	}
	else {
		console.error("Unable to wait for promise!");
	}
	return returnValue;
}

export function waitForCredentials(data){
	data.openChoiceDialog = true;
	return waitForPromise(requestCredentials(data), false);
}

export function waitForPasswordStore(data){
	return waitForPromise(storeCredentials(data), []).reduce(function(alreadyStored, stored){
		return alreadyStored || stored;
	}, false);
}