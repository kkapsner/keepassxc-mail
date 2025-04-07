/* globals Components */
import { cal } from "resource:///modules/calendar/calUtils.sys.mjs";
import { addWindowListener } from "./windowListener.sys.mjs";

const getCredentialInfoForGdata = function(){
	return function getCredentialInfoForGdata(window){
		const request = window.arguments[0].wrappedJSObject;
		
		return {
			host: request.url,
			login: request.account.extraAuthParams.filter(p => p[0] === "login_hint").map(p => p[1])[0],
			loginChangeable: true
		};
	};
}();
const getGuiOperationsForGdata = function(){
	const STATE_STOP = Components.interfaces.nsIWebProgressListener.STATE_STOP;
	
	return function(window){
		const requestFrame = window.document.getElementById("requestFrame");
		let resolveLoginForm;
		let resolvePasswordForm;
		const loginFormPromise = new Promise(function(resolve){resolveLoginForm = resolve;});
		const passwordFormPromise = new Promise(function(resolve){resolvePasswordForm = resolve;});
	
		const progressListener = {
			QueryInterface: cal.generateQI([
				Components.interfaces.nsIWebProgressListener,
				Components.interfaces.nsISupportsWeakReference
			]),
			onStateChange: function(_webProgress, _request, stateFlags, _status){
				if (!(stateFlags & STATE_STOP)) return;
				if (!requestFrame.contentDocument){
					resolveLoginForm(false);
					return;
				}
				const forms = requestFrame.contentDocument.forms;
				if (!forms || forms.length === 0) return;
				const form = forms[0];
				
				if (form.Email){
					resolveLoginForm(form);
				}
				if (form.Passwd){
					resolvePasswordForm(form);
				}
			},
		};
		requestFrame.addProgressListener(progressListener, Components.interfaces.nsIWebProgress.NOTIFY_ALL);
		
		const document = window.document;
		return {
			progressListener,
			window,
			guiParent: document.getElementById("browserRequest"),
			doHandle: async function(){
				const loginForm = await loginFormPromise;
				if (loginForm){
					return true;
				}
				return false;
			},
			submit: async function(){
				const loginForm = await loginFormPromise;
				loginForm.signIn.click();
				
				const passwordForm = await passwordFormPromise;
				passwordForm.signIn.click();
			},
			registerOnSubmit: function(){},
			fillCredentials: async function(credentialInfo, credentials){
				const loginForm = await loginFormPromise;
				loginForm.Email.value = credentials.login;
				
				const passwordForm = await passwordFormPromise;
				passwordForm.Passwd.value = credentials.password;
				
			}
		};
	};
}();
addWindowListener({
	name: "gdataPasswordDialogListener",
	chromeURLs: [
		"chrome://gdata-provider/content/browserRequest.xul",
		"chrome://messenger/content/browserRequest.xhtml"
	],
	getCredentialInfo: getCredentialInfoForGdata,
	getGuiOperations: getGuiOperationsForGdata
});