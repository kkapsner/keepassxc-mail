import { log } from "./log.js";
import { isReady as isKeepassReady, keepass } from "./keepass.js";
import { choiceModal } from "./modal.js";

const lastRequest = {};
export async function getCredentials(credentialInfo){
	log("got credential request:", credentialInfo);
	await isKeepassReady();
	const presentIds = new Map();
	let credentialsForHost = (await keepass.retrieveCredentials(false, [credentialInfo.host, credentialInfo.host]))
		.filter(function(credentials){
			const alreadyPresent = presentIds.has(credentials.uuid);
			if (alreadyPresent){
				return false;
			}
			presentIds.set(credentials.uuid, true);
			return true;
		})
		.filter(function(credential){
			return (credentialInfo.login || !credentialInfo.loginChangeable)?
				(
					credentialInfo.login === true ||
					credential.login.toLowerCase?.() === credentialInfo.login.toLowerCase?.()
				):
				credential.login;
		}).map(function(credential){
			credential.skipAutoSubmit = credential.skipAutoSubmit === "true";
			return credential;
		});
	log("keepassXC provided", credentialsForHost.length, "logins");
	let autoSubmit = (await browser.storage.local.get({autoSubmit: false})).autoSubmit;
	if (autoSubmit){
		const requestId = credentialInfo.login + "|" + credentialInfo.host;
		const now = Date.now();
		if (now - lastRequest[requestId] < 1000){
			autoSubmit = false;
		}
		lastRequest[requestId] = now;
	}
	
	if (
		credentialInfo.openChoiceDialog &&
		credentialsForHost.length
	){
		const selectedUuid = await choiceModal(
			credentialInfo.host,
			credentialInfo.login,
			credentialsForHost.map(function (data){
				return {
					name: data.name,
					login: data.login,
					uuid: data.uuid,
					autoSubmit: autoSubmit && !data.skipAutoSubmit
				};
			})
		);
		const filteredCredentialsForHost = credentialsForHost.filter(e => e.uuid === selectedUuid);
		if (!selectedUuid || filteredCredentialsForHost.length){
			credentialsForHost = filteredCredentialsForHost;
		}
	}
	
	return {
		autoSubmit,
		credentials: credentialsForHost
	};
}