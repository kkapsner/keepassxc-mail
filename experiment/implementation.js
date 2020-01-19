/* globals ChromeUtils, Components*/

const { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");

const getCredentialInfo = function(){
	"use strict";
	
	const stringBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"]
		.getService(Components.interfaces.nsIStringBundleService);
	
	const bundles = {
		commonDialog: stringBundleService.createBundle("chrome://global/locale/commonDialogs.properties"),
		compose: stringBundleService.createBundle("chrome://messenger/locale/messengercompose/composeMsgs.properties"),
		imap: stringBundleService.createBundle("chrome://messenger/locale/imapMsgs.properties"),
		local: stringBundleService.createBundle("chrome://messenger/locale/localMsgs.properties"),
		messenger: stringBundleService.createBundle("chrome://messenger/locale/messenger.properties"),
		news: stringBundleService.createBundle("chrome://messenger/locale/news.properties"),
		wcap: stringBundleService.createBundle("chrome://calendar/locale/wcap.properties"),
	};
	
	const dialogTypes = [];
	function getBundleString(bundleName, stringName){
		return bundles[bundleName].GetStringFromName(stringName);
	}
	function getDialogType({protocol, title, dialog, hostPlaceholder, loginPlaceholder}){
		const hostPosition = hostPlaceholder? dialog.indexOf(hostPlaceholder): -1;
		const loginPosition = loginPlaceholder? dialog.indexOf(loginPlaceholder): -1;
		let dialogRegExpString = dialog.replace(/([\\+*?[^\]$(){}=!|.])/g, "\\$1");
		if (hostPlaceholder){
			dialogRegExpString = dialogRegExpString.replace(hostPlaceholder.replace(/\$/g, "\\$"), "(.+)");
		}
		if (loginPlaceholder){
			dialogRegExpString = dialogRegExpString.replace(loginPlaceholder.replace(/\$/g, "\\$"), "(.+)");
		}
		const dialogRegExp = new RegExp(dialogRegExpString);
		
		return {
			protocol,
			title,
			dialog,
			dialogRegExp,
			hostGroup: hostPosition === -1? false: loginPosition === -1 || loginPosition > hostPosition? 1: 2,
			loginGroup: loginPosition === -1? false: hostPosition === -1 || hostPosition > loginPosition? 1: 2,
		};
	}
	function addDialogType(data){
		dialogTypes.push(getDialogType(data));
	}
	
	addDialogType({
		protocol: "smtp",
		title:  getBundleString("compose", "smtpEnterPasswordPromptTitle"),
		dialog: getBundleString("compose", "smtpEnterPasswordPromptWithUsername"),
		hostPlaceholder: "%1$S",
		loginPlaceholder: "%2$S"
	});
	addDialogType({
		protocol: "smtp",
		title:  getBundleString("compose", "smtpEnterPasswordPromptTitle"),
		dialog: getBundleString("compose", "smtpEnterPasswordPrompt"),
		hostPlaceholder: "%S",
		loginPlaceholder: ""
	});
	addDialogType({
		protocol: "imap",
		title:  getBundleString("imap", "imapEnterPasswordPromptTitle"),
		dialog: getBundleString("imap", "imapEnterServerPasswordPrompt"),
		hostPlaceholder: "%2$S",
		loginPlaceholder: "%1$S"
	});
	addDialogType({
		protocol: "pop3",
		title:  getBundleString("local", "pop3EnterPasswordPromptTitle"),
		dialog: getBundleString("local", "pop3EnterPasswordPrompt"),
		hostPlaceholder: "%2$S",
		loginPlaceholder: "%1$S"
	});
	addDialogType({
		protocol: "pop3",
		title:  getBundleString("local", "pop3EnterPasswordPromptTitle"),
		dialog: getBundleString("local", "pop3PreviouslyEnteredPasswordIsInvalidPrompt"),
		hostPlaceholder: "%2$S",
		loginPlaceholder: "%1$S"
	});
	addDialogType({
		protocol: "nntp-1",
		title:  getBundleString("news", "enterUserPassTitle"),
		dialog: getBundleString("news", "enterUserPassServer"),
		hostPlaceholder: "%S",
		loginPlaceholder: ""
	});
	addDialogType({
		protocol: "nntp-2",
		title:  getBundleString("news", "enterUserPassTitle"),
		dialog: getBundleString("news", "enterUserPassGroup"),
		hostPlaceholder: "%2$S",
		loginPlaceholder: "%1$S"
	});
	addDialogType({
		protocol: false,
		title:  getBundleString("wcap", "loginDialog.label"),
		dialog: getBundleString("commonDialog", "EnterPasswordFor"),
		hostPlaceholder: "%2$S",
		loginPlaceholder: "%1$S"
	});
	addDialogType({
		protocol: false,
		title:  getBundleString("wcap", "loginDialog.label"),
		dialog: getBundleString("commonDialog", "EnterUserPasswordFor2"),
		hostPlaceholder: "%1$S",
		loginPlaceholder: ""
	});
	addDialogType({
		protocol: false,
		title:  getBundleString("commonDialog", "PromptUsernameAndPassword2"),
		dialog: getBundleString("commonDialog", "EnterLoginForRealm3"),
		hostPlaceholder: "%2$S",
		loginPlaceholder: ""
	});
	addDialogType({
		protocol: false,
		title:  getBundleString("commonDialog", "PromptUsernameAndPassword2"),
		dialog: getBundleString("commonDialog", "EnterUserPasswordFor2"),
		hostPlaceholder: "%1$S",
		loginPlaceholder: ""
	});
	addDialogType({
		protocol: false,
		title:  getBundleString("commonDialog", "PromptPassword2"),
		dialog: getBundleString("commonDialog", "EnterPasswordFor"),
		hostPlaceholder: "%2$S",
		loginPlaceholder: "%1$S"
	});
	
	return function getCredentialInfo(window){
		if (["promptPassword", "promptUserAndPass"].indexOf(window.args.promptType) === -1){
			return false;
		}
		
		const matchingTypes = dialogTypes.filter(function(dialogType){
			return dialogType.title === window.args.title;
		}).map(function(dialogType){
			const ret = Object.create(dialogType);
			ret.match = window.args.text.match(dialogType.dialogRegExp);
			return ret;
		}).filter(function(dialogType){
			return dialogType.match;
		});
		if (matchingTypes.length){
			const type = matchingTypes[0];
			const host = type.hostGroup?
				(
					(type.protocol? type.protocol + "://": "") +
					type.match[type.hostGroup]
				): false;
			let login = type.loginGroup? type.match[type.loginGroup]: false;
			let loginChangeable = false;
			if (!login && window.args.promptType === "promptUserAndPass"){
				const loginInput = window.document.getElementById("loginTextbox");
				if (loginInput && loginInput.value){
					login = loginInput.value;
					loginChangeable = true;
				}
			}
			return {host, login, loginChangeable};
		}
		return false;
	};
}();

const getGuiOperations = function(){
	"use strict";
	
	return function(window){
		const document = window.document;
		const commonDialog = document.getElementById("commonDialog");
		return {
			window,
			guiParent: commonDialog,
			submit: function(){
				commonDialog._buttons.accept.click();
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

const getCredentialInfoForGdata = function(){
	"use strict";
	
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
	"use strict";
	
	const { cal } = ChromeUtils.import("resource://calendar/modules/calUtils.jsm");
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
			onStateChange: function(aWebProgress, aRequest, stateFlags, aStatus){
				if (!(stateFlags & STATE_STOP)) return;
				
				const form = requestFrame.contentDocument.forms[0];
				if (!form) return;
				
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
			submit: async function(){
				const loginForm = await loginFormPromise;
				loginForm.signIn.click();
				
				const passwordForm = await passwordFormPromise;
				passwordForm.signIn.click();
			},
			fillCredentials: async function(credentialInfo, credentials){
				const loginForm = await loginFormPromise;
				loginForm.Email.value = credentials.login;
				
				const passwordForm = await passwordFormPromise;
				passwordForm.Passwd.value = credentials.password;
				
			}
		};
	};
}();

const { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
const passwordRequestEmitter = new class extends ExtensionCommon.EventEmitter {
	constructor() {
		super();
		this.callbackCount = 0;
	}

	handleEvent(guiOperations, credentialInfo) {
		passwordRequestEmitter.emit("password-dialog-opened", guiOperations, credentialInfo);
		passwordRequestEmitter.emit("password-requested", guiOperations, credentialInfo);
	}

	add(callback) {
		this.on("password-requested", callback);
		this.callbackCount++;

		if (this.callbackCount === 1) {
			ExtensionSupport.registerWindowListener("passwordDialogListener", {
				chromeURLs: ["chrome://global/content/commonDialog.xul"],
				onLoadWindow: function(window) {
					const credentialInfo = getCredentialInfo(window);
					if (credentialInfo){
						passwordRequestEmitter.handleEvent(getGuiOperations(window), credentialInfo);
					}
				},
			});
			ExtensionSupport.registerWindowListener("gdataPasswordDialogListener", {
				chromeURLs: ["chrome://gdata-provider/content/browserRequest.xul"],
				onLoadWindow: function(window) {
					const credentialInfo = getCredentialInfoForGdata(window);
					if (credentialInfo){
						passwordRequestEmitter.handleEvent(getGuiOperationsForGdata(window), credentialInfo);
					}
				},
			});
		}
	}

	remove(callback) {
		this.off("password-requested", callback);
		this.callbackCount--;

		if (this.callbackCount === 0) {
			ExtensionSupport.unregisterWindowListener("passwordDialogListener");
			ExtensionSupport.unregisterWindowListener("gdataPasswordDialogListener");
		}
	}
};

const translations = {};
function getTranslation(name, variables){
	"use strict";
	
	const translation = translations[name.toLowerCase()] || name;
	if (!variables){
		return translation;
	}
	return translation.replace(/\{\s*([^}]*?)\s*\}/g, function(m, name){
		const namesToTry = name.split(/\s*\|\s*/g);
		for (const name of namesToTry){
			if (name.match(/^["'].*["']$/)){
				return name.replace(/^['"]|['"]$/g, "");
			}
			if (variables[name]){
				return variables[name];
			}
		}
		return m;
	});
}

this.credentials = class extends ExtensionCommon.ExtensionAPI {
	getAPI(context) {
		return {
			credentials: {
				async setTranslation(name, translation) {
					translations[name.toLowerCase()] = translation;
				},
				onCredentialRequested: new ExtensionCommon.EventManager({
					context,
					name: "credentials.onCredentialRequested",
					register(fire) {
						async function callback(event, guiOperations, credentialInfo){
							try {
								const credentialDetails = await fire.async(credentialInfo);
								updateGUI(guiOperations, credentialInfo, credentialDetails);
							}
							catch (e){
								console.log(e);
							}
						}

						passwordRequestEmitter.add(callback);
						return function() {
							passwordRequestEmitter.remove(callback);
						};
					},
				}).api(),

			},
		};
	}
};


function buildDialogGui(guiOperations, credentialInfo){
	"use strict";
	
	const xulNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
	const window = guiOperations.window;
	const document = window.document;
	
	/* add ui elements to dialog */
	const row = document.createElementNS(xulNS, "row");
	row.setAttribute("id", "credentials-row");
	
	// spacer to take up first column in layout
	const spacer = document.createElementNS(xulNS, "spacer");
	spacer.setAttribute("flex", "1");
	row.appendChild(spacer);
	
	// this box displays labels and also the list of entries when fetched
	const box = document.createElementNS(xulNS, "hbox");
	box.setAttribute("id", "credentials-box");
	box.setAttribute("align", "center");
	box.setAttribute("flex", "1");
	box.setAttribute("pack", "start");
	
	const description = document.createElementNS(xulNS, "description");
	description.setAttribute("id", "credentials-description");
	description.setAttribute("align", "start");
	description.setAttribute("flex", "1");
	description.setAttribute("value", getTranslation("loadingPasswords"));
	box.appendChild(description);
	
	const retryButton = document.createElementNS(xulNS, "button");
	retryButton.setAttribute("label", getTranslation("retry"));
	retryButton.addEventListener("command", function(){
		retryButton.style.display = "none";
		description.setAttribute("value", getTranslation("loadingPasswords"));
		passwordRequestEmitter.emit("password-requested", guiOperations, credentialInfo);
		window.sizeToContent();
	});
	retryButton.setAttribute("id", "credentials-retry-button");
	retryButton.style.display = "none";
	box.appendChild(retryButton);
	row.appendChild(box);
	
	guiOperations.guiParent.appendChild(row);
	
	window.sizeToContent();
}
passwordRequestEmitter.on("password-dialog-opened", function(event, guiOperations, credentialInfo){
	"use strict";
	
	buildDialogGui(guiOperations, credentialInfo);
});
function updateGUI(guiOperations, credentialInfo, credentialDetails){
	"use strict";
	
	const xulNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
	const window = guiOperations.window;
	const document = window.document;
	const row = document.getElementById("credentials-row");
	const box = document.getElementById("credentials-box");
	const description = document.getElementById("credentials-description");
	if (!(row && box && description)) {
		return;
	}
	
	function fillCredentials(credentials){
		description.value = getTranslation("pickedEntry", credentials);
		guiOperations.fillCredentials(credentialInfo, credentials);
	}
	const credentials = credentialDetails.credentials;
	if (!credentials.length){
		description.setAttribute("value", getTranslation("noPasswordsFound"));
		document.getElementById("credentials-retry-button").style.display = "";
		window.sizeToContent();
		return;
	}
	
	fillCredentials(credentials[0]);
	if (credentials.length === 1){
		if (credentialDetails.autoSubmit && !credentials[0].skipAutoSubmit){
			guiOperations.submit();
		}
		return;
	}

	const list = document.createElementNS(xulNS, "menulist");
	list.setAttribute("id", "credentials-list");
	const popup = document.createElementNS(xulNS, "menupopup");

	credentials.forEach(function(credentials){
		const item = document.createElementNS(xulNS, "menuitem");
		item.setAttribute("label", getTranslation("entryLabel", credentials));
		item.setAttribute("tooltiptext", getTranslation("entryTooltip", credentials));
		item.addEventListener("command", function(){
			fillCredentials(credentials);
			if (credentialDetails.autoSubmit && !credentials.skipAutoSubmit){
				guiOperations.submit();
			}
		});
		popup.appendChild(item);
	});

	list.appendChild(popup);
	box.appendChild(list);
	
	window.sizeToContent();
}