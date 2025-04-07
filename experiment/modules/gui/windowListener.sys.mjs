
import { ExtensionSupport } from "resource:///modules/ExtensionSupport.sys.mjs";
import { addSetup } from "../setup.sys.mjs";
import { passwordEmitter } from "../emitters.sys.mjs";
import { buildDialogGui, updateGUI } from "./utils.sys.mjs";
import { requestCredentials } from "../credentials.sys.mjs";

const windowListeners = [];

export function addWindowListener(data){
	if (!data){
		return;
	}
	windowListeners.push(data);
}


function registerWindowListener(){
	async function handleEvent(guiOperations, credentialInfo){
		if (guiOperations.doHandle && !(await guiOperations.doHandle())){
			return;
		}
		buildDialogGui(guiOperations, credentialInfo);
		const credentialDetails = await requestCredentials(credentialInfo);
		updateGUI(guiOperations, credentialInfo, credentialDetails);
		if (guiOperations.registerOnSubmit){
			guiOperations.registerOnSubmit(function(login, password){
				if (
					credentialInfo.login &&
					!credentialInfo.loginChangeable
				){
					login = credentialInfo.login;
				}
				if (!credentialDetails.credentials.some(function(credentials){
					return login === credentials.login && password === credentials.password;
				})){
					passwordEmitter.emit("password", {
						login,
						password,
						host: credentialInfo.host
					});
				}
			});
		}
	}
	
	windowListeners.forEach(function(listener){
		ExtensionSupport.registerWindowListener(listener.name, {
			chromeURLs: listener.chromeURLs,
			onLoadWindow: function(window){
				const credentialInfo = listener.getCredentialInfo(window);
				if (credentialInfo){
					handleEvent(listener.getGuiOperations(window), credentialInfo);
				}
			},
		});
	});
}
function unregisterWindowListener(){
	windowListeners.forEach(function(listener){
		ExtensionSupport.unregisterWindowListener(listener.name);
	});
}
addSetup({
	setup: registerWindowListener,
	shutdown: unregisterWindowListener
});