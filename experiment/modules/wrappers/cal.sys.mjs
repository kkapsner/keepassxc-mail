
import { cal } from "resource:///modules/calendar/calUtils.sys.mjs";
import { waitForCredentials } from "../wait.sys.mjs";
import { storeCredentials } from "../credentials.sys.mjs";
import { addSetup } from "../setup.sys.mjs";

const originalPasswordManagerGet = cal.auth.passwordManagerGet;
const originalPasswordManagerSave = cal.auth.passwordManagerSave;

const getAuthCredentialInfo = function getAuthCredentialInfo(login, host){
	return {
		login: login,
		host: host.replace(/^oauth:([^/]{2})/, "oauth://$1")
	};
};
const changePasswordManager = function changePasswordManager(){
	cal.auth.passwordManagerGet = function(login, passwordObject, host, realm){
		if (host.startsWith("oauth:")){
			const credentialDetails = waitForCredentials(getAuthCredentialInfo(login, host));
			if (
				credentialDetails &&
				credentialDetails.credentials.length &&
				(typeof credentialDetails.credentials[0].password) === "string"
			){
				passwordObject.value = credentialDetails.credentials[0].password;
				return true;
			}
		}
		return originalPasswordManagerGet.call(this, login, passwordObject, host, realm);
	};
	cal.auth.passwordManagerSave = function(login, password, host, realm){
		if (host.startsWith("oauth:")){
			const credentialInfo = getAuthCredentialInfo(login, host);
			credentialInfo.password = password;
			credentialInfo.callback = (stored) => {
				if (!stored){
					originalPasswordManagerSave.call(this, login, password, host, realm);
				}
			};
			storeCredentials(credentialInfo);
			return false;
		}
		
		return originalPasswordManagerSave.call(this, login, password, host, realm);
	};
};
const restorePasswordManager = function restorePasswordManager(){
	cal.auth.passwordManagerGet = originalPasswordManagerGet;
	cal.auth.passwordManagerSave = originalPasswordManagerSave;
};
addSetup({
	setup: changePasswordManager,
	shutdown: restorePasswordManager
});