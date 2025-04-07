import { ExtensionParent }  from "resource://gre/modules/ExtensionParent.sys.mjs";
import { setTimeout } from "resource://gre/modules/Timer.sys.mjs";
import { log } from "../log.sys.mjs";
import { passwordEmitter } from "../emitters.sys.mjs";
import { waitForCredentials } from "../wait.sys.mjs";
import { addDialogType } from "../dialogStrings.sys.mjs";
import { addSetup } from "../setup.sys.mjs";

const cardBookExtension = ExtensionParent.GlobalManager.getExtension("cardbook@vigneau.philippe");
if (cardBookExtension){
	log(addDialogType({
		protocol: false,
		title: cardBookExtension.localeData.localizeMessage("wdw_passwordMissingTitle"),
		dialog: ["commonDialog", "EnterPasswordFor"],
		hostPlaceholder: "%2$S",
		loginPlaceholder: "%1$S"
	}));
	
	let tries = 0;
	const loadCardbookPasswordManager = async function loadCardbookPasswordManager(){
		try {
			const { cardbookXULPasswordManager } = await import(
				"chrome://cardbook/content/XUL/utils/cardbookXULPasswordManager.js"
			);
			return cardbookXULPasswordManager;
		}
		catch (error){
			log("loading cardbookXULPasswordManager failed:", error);
			log("try loading cardbookRepository");
			const { cardbookRepository } = await import("chrome://cardbook/content/cardbookRepository.js");
			return cardbookRepository.cardbookPasswordManager;
		}
	};
	const registerCardbook = async function registerCardbook(){
		tries += 1;
		try {
			log("try to register cardbook");
			const passwordManager = await loadCardbookPasswordManager();
			const originalGetPassword = passwordManager.getPassword;
			const alteredGetPassword = function(username, url){
				const credentialDetails = waitForCredentials({
					login: username,
					host: url
				});
				if (
					credentialDetails &&
					credentialDetails.credentials.length &&
					(typeof credentialDetails.credentials[0].password) === "string"
				){
					return credentialDetails.credentials[0].password;
				}
				return originalGetPassword.call(this, username, url);
			};
			const originalRememberPassword = passwordManager.rememberPassword;
			const alteredRememberPassword = function(username, url, password, save){
				if (save){
					const credentialInfo = {
						login: username,
						password: password,
						host: url
					};
					credentialInfo.callback = (stored) => {
						if (!stored){
							originalRememberPassword.call(this, username, url, password, save);
						}
					};
					passwordEmitter.emit("password", credentialInfo);
					return originalRememberPassword.call(this, username, url, password, false);
				}
				return originalRememberPassword.call(this, username, url, password, save);
			};
			addSetup({
				setup: function(){
					passwordManager.getPassword = alteredGetPassword;
					passwordManager.rememberPassword = alteredRememberPassword;
				},
				shutdown: function(){
					passwordManager.getPassword = originalGetPassword;
					passwordManager.rememberPassword = originalRememberPassword;
				}
			});
			log("... cardbook registered");
		}
		catch (error){
			log("... cardbook registering failed", tries, "times");
			if (tries < 50){
				setTimeout(registerCardbook, 10);
			}
			else {
				log("unable to register support for CardBook", error);
			}
		}
	};
	setTimeout(registerCardbook, 1);
}