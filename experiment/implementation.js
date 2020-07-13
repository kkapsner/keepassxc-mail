/* globals ChromeUtils, Components*/
"use strict";

const { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
const { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

const windowListeners = [];
const setupFunctions = [];
const passwordEmitter = new ExtensionCommon.EventEmitter();

const getCredentialInfoFromStrings = function(){
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
		try {
			return bundles[bundleName].GetStringFromName(stringName);
		}
		catch(e){
			console.log("KeePassXC-Mail: unable to get", stringName, "from bundle", bundleName);
			return stringName;
		}
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
	return function getCredentialInfoFromStrings(title, text){
		const matchingTypes = dialogTypes.filter(function(dialogType){
			return dialogType.title === title;
		}).map(function(dialogType){
			const ret = Object.create(dialogType);
			ret.match = text.match(dialogType.dialogRegExp);
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
			return {host, login};
		}
		return false;
	};
}();

function getCredentialInfo(window){
	const promptType = window.args.promptType;
	if (["promptPassword", "promptUserAndPass"].indexOf(promptType) === -1){
		return false;
	}
	
	function loginChangeable(login){
		if (!login && promptType === "promptUserAndPass"){
			const loginInput = window.document.getElementById("loginTextbox");
			if (loginInput && loginInput.value){
				login = loginInput.value;
				return true;
			}
		}
		return false;
	}
	const promptData = getCredentialInfoFromStrings(window.args.title, window.args.text);
	if (promptData){
		return {
			host: promptData.host,
			login: promptData.login,
			loginChangeable: loginChangeable(promptData.login),
		};
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
windowListeners.push({
	name: "passwordDialogListener",
	chromeURLs: ["chrome://global/content/commonDialog.xul"],
	getCredentialInfo,
	getGuiOperations
});


function registerWindowListener(){
	async function handleEvent(guiOperations, credentialInfo) {
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
			onLoadWindow: function(window) {
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
setupFunctions.push({
	setup: registerWindowListener,
	shutdown: unregisterWindowListener
});

try {
	// gdata support
	const { cal } = ChromeUtils.import("resource://calendar/modules/calUtils.jsm");
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
	windowListeners.push({
		name: "gdataPasswordDialogListener",
		chromeURLs: ["chrome://gdata-provider/content/browserRequest.xul"],
		getCredentialInfo: getCredentialInfoForGdata,
		getGuiOperations: getGuiOperationsForGdata
	});

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
				passwordEmitter.emit("password", credentialInfo);
				return false;
			}
			
			return originalPasswordManagerSave.call(this, login, password, host, realm);
		};
	};
	const restorePasswordmanager = function restorePasswordmanager(){
		cal.auth.passwordManagerGet = originalPasswordManagerGet;
		cal.auth.passwordManagerSave = originalPasswordManagerSave;
	};
	setupFunctions.push({
		setup: changePasswordManager,
		shutdown: restorePasswordmanager
	});
}
catch (error){
	console.log("KeePassXC-Mail: unable to register support for gdata", error);
}

const passwordRequestEmitter = new class extends ExtensionCommon.EventEmitter {
	constructor() {
		super();
		this.callbackCount = 0;
	}

	add(callback) {
		this.on("password-requested", callback);
		this.callbackCount++;

		if (this.callbackCount === 1) {
			setupFunctions.forEach(function(setupFunction){
				setupFunction.setup();
			});
		}
	}

	remove(callback) {
		this.off("password-requested", callback);
		this.callbackCount--;

		if (this.callbackCount === 0) {
			setupFunctions.forEach(function(setupFunction){
				setupFunction.shutdown();
			});
		}
	}
};

async function requestCredentials(credentialInfo){
	const eventData = await passwordRequestEmitter.emit(
		"password-requested", credentialInfo
	);
	return eventData.reduce(function(details, currentDetails){
		if (!currentDetails){
			return details;
		}
		details.autoSubmit &= currentDetails.autoSubmit;
		if (currentDetails.credentials && currentDetails.credentials.length){
			details.credentials = details.credentials.concat(currentDetails.credentials);
		}
		return details;
	}, {autoSubmit: true, credentials: []});
}

function waitForCredentials(data){
	let finished = false;
	let returnValue = false;
	requestCredentials(data).then(function(credentialDetails){
		finished = true;
		returnValue = credentialDetails;
		return returnValue;
	}).catch(function(){
		finished = true;
	});
	Services.tm.spinEventLoopUntilOrShutdown(() => finished);
	return returnValue;
}

const translations = {};
function getTranslation(name, variables){
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
						return function() {
							passwordRequestEmitter.remove(callback);
						};
					},
				}).api(),
				onNewCredential: new ExtensionCommon.EventManager({
					context,
					name: "credentials.onNewCredential",
					register(fire) {
						async function callback(event, credentialInfo){
							try {
								return await fire.async(credentialInfo);
							}
							catch (e){
								console.error(e);
								return false;
							}
						}
						
						passwordEmitter.on("password", callback);
						return function() {
							passwordEmitter.off("password", callback);
						};
					},
				}).api(),
			},
		};
	}
};


function buildDialogGui(guiOperations, credentialInfo){
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
	retryButton.addEventListener("command", async function(){
		retryButton.style.display = "none";
		description.setAttribute("value", getTranslation("loadingPasswords"));
		const credentialDetails = await requestCredentials(credentialInfo);
		updateGUI(guiOperations, credentialInfo, credentialDetails);
		window.sizeToContent();
	});
	retryButton.setAttribute("id", "credentials-retry-button");
	retryButton.style.display = "none";
	box.appendChild(retryButton);
	row.appendChild(box);
	
	guiOperations.guiParent.appendChild(row);
	
	// hide "save password" checkbox
	const checkbox = document.getElementById("checkbox");
	if (checkbox){
		checkbox.checked = false;
	}
	const checkboxContainer = document.getElementById("checkboxContainer");
	if (checkboxContainer){
		checkboxContainer.hidden = true;
	}
	
	window.sizeToContent();
}
function updateGUI(guiOperations, credentialInfo, credentialDetails){
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