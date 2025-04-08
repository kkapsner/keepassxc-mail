import { getCredentialInfoFromStrings } from "../dialogStrings.sys.js";
import { addWindowListener } from "./windowListener.sys.js";

function getCredentialInfo(window){
	const promptType = window.args.promptType;
	if (["promptPassword", "promptUserAndPass"].indexOf(promptType) === -1){
		return false;
	}
	
	const promptData = getCredentialInfoFromStrings(window.args.title, window.args.text);
	if (promptData){
		const host = promptData.host;
		let login = promptData.login;
		let loginChangeable = false;
		if (!login && promptType === "promptUserAndPass"){
			const loginInput = window.document.getElementById("loginTextbox");
			if (loginInput && loginInput.value){
				login = loginInput.value;
			}
			loginChangeable = true;
		}
		return {host, login, loginChangeable};
	}
	return false;
}

const getGuiOperations = function(){
	return function(window){
		const document = window.document;
		const commonDialog = document.getElementById("commonDialog");
		return {
			window,
			guiParent: commonDialog,
			submit: function(){
				commonDialog._buttons.accept.click();
			},
			registerOnSubmit: function(callback){
				let submitted = false;
				function submit(){
					if (!submitted){
						submitted = true;
						callback(
							document.getElementById("loginTextbox").value,
							document.getElementById("password1Textbox").value
						);
					}
				}
				commonDialog._buttons.accept.addEventListener("command", submit);
				commonDialog.addEventListener("dialogaccept", submit);
			},
			fillCredentials: function(credentialInfo, credentials){
				if (
					!credentialInfo.login ||
					credentialInfo.loginChangeable
				){
					document.getElementById("loginTextbox").value = credentials.login;
				}
				document.getElementById("password1Textbox").value = credentials.password;
			}
		};
	};
}();
addWindowListener({
	name: "passwordDialogListener",
	chromeURLs: [
		"chrome://global/content/commonDialog.xul",
		"chrome://global/content/commonDialog.xhtml",
	],
	getCredentialInfo,
	getGuiOperations
});