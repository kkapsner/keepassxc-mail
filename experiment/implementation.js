/* globals ChromeUtils, Cc, Ci, Components, XPCOMUtils, globalThis*/
/* eslint eslint-comments/no-use: off */
/* eslint {"indent": ["error", "tab", {"SwitchCase": 1, "outerIIFEBody": 0}]}*/
"use strict";
((exports) => {
function importModule(path, addExtension = true){
	if (ChromeUtils.import){
		return ChromeUtils.import(path + (addExtension? ".jsm": ""));
	}
	else if (ChromeUtils.importESModule){
		return ChromeUtils.importESModule(path + (addExtension? ".sys.mjs": ""));
	}
	else {
		throw "Unable to import module " + path;
	}
}
const { ExtensionCommon } = importModule("resource://gre/modules/ExtensionCommon");
const { ExtensionParent } = importModule("resource://gre/modules/ExtensionParent");

const Services = function(){
	let Services;
	try {
		Services = globalThis.Services;
	}
	// eslint-disable-next-line no-empty
	catch (error){}
	return Services || importModule("resource://gre/modules/Services").Services;
}();

// prepare to load ES modules

const extension = ExtensionParent.GlobalManager.getExtension("keepassxc-mail@kkapsner.de");

const resProto = Cc[
	"@mozilla.org/network/protocol;1?name=resource"
].getService(Ci.nsISubstitutingProtocolHandler);

resProto.setSubstitutionWithFlags(
	"keepassxc-mail",
	Services.io.newURI(
		"experiment",
		null,
		extension.rootURI
	),
	resProto.ALLOW_CONTENT_ACCESS
);

const { log } = ChromeUtils.importESModule(
	`resource://keepassxc-mail/experiment/modules/log.sys.js?${extension.addonData.version}`
);
function importOwnModule(name){
	try {
		const path = `resource://keepassxc-mail/experiment/modules/${name}?${extension.addonData.version}`;
		// log("Loading", path);
		return ChromeUtils.importESModule(path);
	}
	catch (error){
		log(`Unable to load ${name}:`, error);
		return {};
	}
}
const { passwordEmitter, passwordRequestEmitter } = importOwnModule("emitters.sys.js");

importOwnModule("onlineOfflineControl.sys.js");

importOwnModule("prompter/asyncPrompter.sys.js");
importOwnModule("prompter/loginManagerAuthPrompter.sys.js");
importOwnModule("prompter/prompter.sys.js");

importOwnModule("gui/commonDialog.sys.js");

importOwnModule("wrappers/cal.sys.js");
importOwnModule("wrappers/oauth2Module.sys.js");
importOwnModule("wrappers/oauth2.sys.js");

exports.credentials = class extends ExtensionCommon.ExtensionAPI {
	getAPI(context){
		return {
			credentials: {
				onCredentialRequested: new ExtensionCommon.EventManager({
					context,
					name: "credentials.onCredentialRequested",
					register(fire){
						async function callback(event, credentialInfo){
							try {
								return await fire.async(credentialInfo);
							}
							catch (e){
								console.error(e);
								return false;
							}
						}
						
						passwordRequestEmitter.add(callback);
						return function(){
							passwordRequestEmitter.remove(callback);
						};
					},
				}).api(),
				onNewCredential: new ExtensionCommon.EventManager({
					context,
					name: "credentials.onNewCredential",
					register(fire){
						async function callback(event, credentialInfo){
							try {
								const callback = credentialInfo.callback;
								delete credentialInfo.callback;
								const returnValue = await fire.async(credentialInfo);
								if (callback){
									await callback(returnValue);
								}
								return returnValue;
							}
							catch (e){
								console.error(e);
								return false;
							}
						}
						
						passwordEmitter.on("password", callback);
						return function(){
							passwordEmitter.off("password", callback);
						};
					},
				}).api(),
			},
		};
	}
	
	onShutdown(isAppShutdown){
		if (isAppShutdown) {
		  return; // the application gets unloaded anyway
		}
		resProto.setSubstitution(
			"keepassxc-mail",
			null
		);
		
		// Flush all caches.
		Services.obs.notifyObservers(null, "startupcache-invalidate");
	}
};


})(this);