import { log } from "./log.js";
import { confirmModal } from "./modal.js";
import { getCredentials } from "./getCredentials.js";
import { storeCredentials } from "./storeCredentials.js";
import { getPrivileges, setPrivileges } from "./externalPrivileges.js";

const messageTypes = {
	test: {
		neededPrivileges: [],
		needsData: false,
		callback: data => "Yes, KPM is installed and responding",
	},
	"request-credentials": {
		neededPrivileges: ["request"],
		needsData: true,
		callback: async data => {
			log("requesting credentials", data);
			const credentialData = await getCredentials({
				host: data.host,
				login: data.login,
				loginChangeable: data.loginChangeable
			});
			return credentialData.credentials.map(credentials => {
				return {
					login: credentialData.login,
					password: credentials.password,
				};
			});
		},
	},
	"store-credentials": {
		neededPrivileges: ["store"],
		needsData: true,
		callback: async data => {
			log("storing credentials", data);
			return storeCredentials({host: data.host, login: data.login, password: data.password});
		},
	},
};

async function extensionHasPrivilege(extensionData, privilege){
	log("Checking if", extensionData.id, "has the privilege", privilege);
	const privileges = await getPrivileges(extensionData.id);
	if ("boolean" === typeof privileges[privilege]){
		return privileges[privilege];
	}
	
	const extension = await browser.management.get(extensionData.id);
	const decision = await confirmModal(
		browser.i18n.getMessage("privilegeRequest.title"),
		browser.i18n.getMessage("privilegeRequest.message")
			.replace("{typeMessage}", browser.i18n.getMessage(`privilegeRequest.message.${privilege}`))
			.replace("{extensionName}", extension.name)
	);
	setPrivileges(extensionData.id, privilege, decision);
	return decision;
}

async function extensionHasAllPrivileges(extension, privileges){
	return (await Promise.all(privileges.map(privilege => extensionHasPrivilege(extension, privilege)))).every(a => a);
}

browser.runtime.onMessageExternal.addListener(async function(message, extension){
	if (!extension || !extension.id){
		log("External extension not verifiable:", extension);
	}
	const messageType = messageTypes[message.type];
	if (!messageType){
		log("Invalid external message", message, "from", extension.id);
		return null;
	}
	if (messageType.needsData && !message.data){
		log("Needed data for", message.type, "from", extension.id, "not provided:", message);
		return null;
	}
	if (!(await extensionHasAllPrivileges(extension, messageType.neededPrivileges))){
		log(extension.id, "does not have the privileges to perform", message.type);
		return null;
	}
	return messageType.callback(message.data);
});