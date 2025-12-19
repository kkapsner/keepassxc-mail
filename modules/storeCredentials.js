import { log } from "./log.js";
import { keepass, isReady as isKeepassReady, handleLockedDatabase } from "./keepass.js";
import { wait } from "./utils.js";
import { messageModal, savingPasswordModal } from "./modal.js";
import { selectedEntries } from "./selected.js";

const timeoutSymbol = Symbol("timeout");
async function storeCredentialsToDatabase(credentialInfo, uuid){
	
	log("Get or create password group");
	const group = await Promise.any([
		keepass.createNewGroup(null, ["KeePassXC-Mail Passwords"]),
		wait(1 * 60 * 1000, timeoutSymbol)
	]);
	if (group === timeoutSymbol){
		log("Timeout while creating password group: using default password manager");
		messageModal(
			browser.i18n.getMessage("createPasswordGroup.timeout.title"),
			browser.i18n.getMessage("createPasswordGroup.timeout.message")
				.replace("{account}", credentialInfo.login)
		);
		return false;
	}
	
	log("Saving password to database for", credentialInfo.login, "at", credentialInfo.host);
	log("Using uuid:", uuid);
	
	const result = await Promise.any([
		keepass.updateCredentials(null, [
			uuid,
			credentialInfo.login, credentialInfo.password, credentialInfo.host,
			group.name, group.uuid
		]),
		wait(2 * 60 * 1000, timeoutSymbol)
	]);
	if (result === timeoutSymbol){
		log("Timeout while saving: using default password manager");
		messageModal(
			browser.i18n.getMessage("savePassword.timeout.title"),
			browser.i18n.getMessage("savePassword.timeout.message")
				.replace("{account}", credentialInfo.login)
		);
		return false;
	}
	else {
		log("Saving done");
		return true;
	}
}

export async function storeCredentials(credentialInfo){
	log("Got new password for", credentialInfo.login, "at", credentialInfo.host);
	const {saveNewCredentials, autoSaveNewCredentials} = (await browser.storage.local.get({
		saveNewCredentials: true,
		autoSaveNewCredentials: false
	}));
	if (!saveNewCredentials){
		log("password saving is disabled in the settings");
		return false;
	}
	
	await isKeepassReady();
	const existingCredentials = (await keepass.retrieveCredentials(
		false,
		[credentialInfo.host, credentialInfo.host]
	)).filter(function (credential){
		return (
			true === credentialInfo.login ||
			credential.login.toLowerCase?.() === credentialInfo.login.toLowerCase?.()
		);
	});
	if (keepass.isDatabaseClosed){
		if (await handleLockedDatabase()){
			return storeCredentials(credentialInfo);
		}
		else {
			log("Unable to unlock database. Cannot store.");
			return true;
		}
	}
	if (existingCredentials.some(function(credential){
		return credential.password === credentialInfo.password;
	})){
		log("the password is already stored");
		return true;
	}
	
	const cachedId = credentialInfo.login?
		`${credentialInfo.login}@${credentialInfo.host}`:
		credentialInfo.host;
	const cached = selectedEntries.get(cachedId) || null;
	const {save, uuid} = autoSaveNewCredentials?
		{save: true, uuid: cached?.uuid || null}:
		await savingPasswordModal(
			credentialInfo.host,
			credentialInfo.login,
			existingCredentials.map(function (data){
				return {
					name: data.name,
					login: data.login,
					uuid: data.uuid,
					preselected: data.uuid === cached?.uuid
				};
			})
		);
	if (!save){
		log("the user decided to not store the password");
		return true;
	}
	
	return await storeCredentialsToDatabase(credentialInfo, uuid);
}