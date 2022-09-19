/* globals ChromeUtils, Components, XPCOMUtils, Localization*/
"use strict";

const { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
const { ExtensionSupport } = ChromeUtils.import("resource:///modules/ExtensionSupport.jsm");
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
XPCOMUtils.defineLazyGlobalGetters(this, ["Localization"]);

const windowListeners = [];
const setupFunctions = [];
const passwordEmitter = new ExtensionCommon.EventEmitter();
let currentPromptData = null;

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
		pipnss: stringBundleService.createBundle("chrome://pipnss/locale/pipnss.properties"),
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
	function getDialogType({
		protocol, title, titleRegExp, dialog, hostPlaceholder, loginPlaceholder, otherPlaceholders
	}){
		const hostPosition = hostPlaceholder? dialog.indexOf(hostPlaceholder): -1;
		const loginPosition = loginPlaceholder? dialog.indexOf(loginPlaceholder): -1;
		let dialogRegExpString = dialog.replace(/([\\+*?[^\]$(){}=!|.])/g, "\\$1");
		if (hostPlaceholder){
			dialogRegExpString = dialogRegExpString.replace(hostPlaceholder.replace(/\$/g, "\\$"), "(.+)");
		}
		if (loginPlaceholder){
			dialogRegExpString = dialogRegExpString.replace(loginPlaceholder.replace(/\$/g, "\\$"), "(.+)");
		}
		if (otherPlaceholders){
			otherPlaceholders.forEach(function(otherPlaceholder){
				dialogRegExpString = dialogRegExpString.replace(otherPlaceholder.replace(/\$/g, "\\$"), ".+");
			});
		}
		const dialogRegExp = new RegExp(dialogRegExpString);
		
		return {
			protocol,
			title: titleRegExp?
				new RegExp(title.replace(/([\\+*?[^\]$(){}=!|.])/g, "\\$1").replace(/%(?:\d+\\\$)?S/, ".+")):
				title,
			dialog,
			dialogRegExp,
			hostGroup: hostPosition === -1? false: loginPosition === -1 || loginPosition > hostPosition? 1: 2,
			loginGroup: loginPosition === -1? false: hostPosition === -1 || hostPosition > loginPosition? 1: 2,
		};
	}
	function addDialogType(data){
		const dialogType = getDialogType(data);
		dialogTypes.push(dialogType);
		return dialogType;
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
		protocol: "smtp",
		title:  getBundleString("compose", "smtpEnterPasswordPromptTitleWithHostname"),
		titleRegExp: true,
		dialog: getBundleString("compose", "smtpEnterPasswordPromptWithUsername"),
		hostPlaceholder: "%1$S",
		loginPlaceholder: "%2$S"
	});
	addDialogType({
		protocol: "smtp",
		title:  getBundleString("compose", "smtpEnterPasswordPromptTitleWithHostname"),
		titleRegExp: true,
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
		protocol: "imap",
		title:  getBundleString("imap", "imapEnterPasswordPromptTitleWithUsername"),
		titleRegExp: true,
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
		protocol: "pop3",
		title:  getBundleString("local", "pop3EnterPasswordPromptTitleWithUsername"),
		titleRegExp: true,
		dialog: getBundleString("local", "pop3EnterPasswordPrompt"),
		hostPlaceholder: "%2$S",
		loginPlaceholder: "%1$S"
	});
	addDialogType({
		protocol: "pop3",
		title:  getBundleString("local", "pop3EnterPasswordPromptTitleWithUsername"),
		titleRegExp: true,
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
		title:  getBundleString("commonDialog", "PromptUsernameAndPassword3"),
		titleRegExp: true,
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
		title:  getBundleString("commonDialog", "PromptUsernameAndPassword3"),
		titleRegExp: true,
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
	["CertPassPromptDefault", "CertPasswordPromptDefault"].forEach(function(dialogStringName){
		// master password is called primary password in the UI
		const masterType = addDialogType({
			protocol: false,
			title:  getBundleString("commonDialog", "PromptPassword3"),
			dialog: getBundleString("pipnss", dialogStringName),
			titleRegExp: true,
			hostPlaceholder: "",
			loginPlaceholder: ""
		});
		masterType.forcedHost = "masterPassword://Thunderbird";
		masterType.noLoginRequired = true;
	});
	
	const pgpI10n = new Localization(["messenger/openpgp/keyWizard.ftl"], true);
	if (pgpI10n){
		const openPGPType = addDialogType({
			protocol: "openpgp",
			title:  pgpI10n.formatValueSync("openpgp-passphrase-prompt-title"),
			dialog: pgpI10n.formatValueSync("openpgp-passphrase-prompt", {key: "%1$S, %2$S, %3$S"}),
			hostPlaceholder: "%1$S",
			// loginPlaceholder: "%2$S",
			otherPlaceholders: ["%2$S", "%3$S"]
		});
		openPGPType.noLoginRequired = true;
	}
	
	return function getCredentialInfoFromStrings(title, text, knownProtocol = false){
		const matchingTypes = (
			knownProtocol?
				dialogTypes.filter(function(dialogType){
					return dialogType.protocol === knownProtocol;
				}):
				dialogTypes
		).filter(function(dialogType){
			return dialogType.title === title || (dialogType.title.test && dialogType.title.test(title));
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
				): type.forcedHost || false;
			let login = type.loginGroup?
				type.match[type.loginGroup]:
				type.noLoginRequired || false;
			return {host, login};
		}
		return false;
	};
}();

function registerPromptFunctions(promptFunctions){
	setupFunctions.push({
		setup: function(){
			promptFunctions.forEach(function(promptFunction){
				promptFunction.object[promptFunction.name] = promptFunction.replacement;
			});
		},
		shutdown: function(){
			promptFunctions.forEach(function(promptFunction){
				promptFunction.object[promptFunction.name] = promptFunction.original;
			});
		}
	});
}

function createPromptDataFunctions(promptFunction){
	const promptDataFunctions = [() => currentPromptData];
	if (promptFunction.dataFunction){
		promptDataFunctions.push(promptFunction.dataFunction);
	}
	if (promptFunction.hasOwnProperty("realmIndex")){
		promptDataFunctions.push(function(args){
			const realm = args[promptFunction.realmIndex];
			let [realmHost, , realmLogin] = this._getRealmInfo(realm);
			let protocol;
			if (realmHost && realmHost.startsWith("mailbox://")){
				realmHost = realmHost.replace("mailbox://", "pop3://");
				protocol = "pop3";
			}
			else {
				protocol = realmHost && Services.io.newURI(realmHost).scheme;
			}
			// realm data provides the correct protocol but may have wrong server name
			const {host: stringHost, login: stringLogin} = getCredentialInfoFromStrings(
				args[promptFunction.titleIndex],
				args[promptFunction.textIndex],
				protocol
			);
			return {
				host: stringHost || realmHost,
				login: stringLogin || decodeURIComponent(realmLogin),
				realm,
			};
		});
	}
	if (promptFunction.hasOwnProperty("titleIndex")){
		promptDataFunctions.push(function(args){
			return getCredentialInfoFromStrings(
				args[promptFunction.titleIndex],
				args[promptFunction.textIndex]
			);
		});
	}
	if (promptFunction.hasOwnProperty("authInfoIndex")){
		promptDataFunctions.push(function(args){
			return {
				host: args[promptFunction.channelIndex].URI.spec,
				login: args[promptFunction.authInfoIndex].username,
				realm: args[promptFunction.authInfoIndex].realm,
			};
		});
	}
	return promptDataFunctions;
}

function initPromptFunction(promptFunction, object){
	promptFunction.object = object;
	promptFunction.promptDataFunctions = createPromptDataFunctions(promptFunction);
	promptFunction.loginChangeable = promptFunction.promptType === "promptUserAndPass";
	promptFunction.original = object[promptFunction.name];
	promptFunction.replacement = function(...args){
		const data = promptFunction.promptDataFunctions.reduce((data, func) => {
			if (!data){
				return func.call(this, args);
			}
			return data;
		}, false);
		if (data && currentPromptData !== data){
			currentPromptData = data;
			if (promptFunction.hasOwnProperty("passwordObjectIndex") || promptFunction.setCredentials){
				const { credentials } = waitForCredentials({
					host: data.host,
					login: data.login,
					loginChangeable: promptFunction.loginChangeable,
				});
				if (credentials.length === 1){
					if (promptFunction.setCredentials){
						promptFunction.setCredentials(args, data.login, credentials[0].password);
					}
					else {
						args[promptFunction.passwordObjectIndex].value = credentials[0].password;
					}
					currentPromptData = null;
					return true;
				}
			}
		}
		const ret = promptFunction.original.call(this, ...args);
		currentPromptData = null;
		return ret;
	};
}

function initPromptFunctions(promptFunctions, object){
	promptFunctions.forEach(function(promptFunction){
		initPromptFunction(promptFunction, object);
	});
}

try {
	const { MsgAuthPrompt } = ChromeUtils.import("resource:///modules/MsgAsyncPrompter.jsm");
	const promptFunctions = [
		{
			name: "prompt",
			promptType: "promptPassword",
			titleIndex: 0,
			textIndex: 1,
			realmIndex: 2,
			passwordObjectIndex: 5,
		},
		{
			name: "promptPassword",
			promptType: "promptPassword",
			titleIndex: 0,
			textIndex: 1,
			realmIndex: 2,
			passwordObjectIndex: 4,
		},
		{
			name: "promptUsernameAndPassword",
			promptType: "promptUserAndPass",
			titleIndex: 0,
			textIndex: 1,
			realmIndex: 2,
			passwordObjectIndex: 5,
		}
	];
	initPromptFunctions(promptFunctions, MsgAuthPrompt.prototype);
	registerPromptFunctions(promptFunctions);
}
catch (error){
	console.log("KeePassXC-Mail: unable to change MsgAuthPrompt:", error);
}

try {
	const { LoginManagerAuthPrompter } = ChromeUtils.import("resource://gre/modules/LoginManagerAuthPrompter.jsm");
	const promptFunctions = [
		{
			name: "promptPassword",
			promptType: "promptPassword",
			titleIndex: 0,
			textIndex: 1,
			realmIndex: 2,
			passwordObjectIndex: 4,
		},
		{
			name: "promptUsernameAndPassword",
			promptType: "promptUserAndPass",
			titleIndex: 0,
			textIndex: 1,
			realmIndex: 2,
			passwordObjectIndex: 5,
		}
	];
	initPromptFunctions(promptFunctions, LoginManagerAuthPrompter.prototype);
	registerPromptFunctions(promptFunctions);
}
catch (error){
	console.log("KeePassXC-Mail: unable to change LoginManagerAuthPrompter:", error);
}

try {
	const { Prompter } = ChromeUtils.import("resource://gre/modules/Prompter.jsm");
	const promptFunctions = [
		{
			name: "promptUsernameAndPassword",
			promptType: "promptUserAndPass",
			titleIndex: 1,
			textIndex: 2,
			passwordObjectIndex: 4,
		},
		{
			name: "promptUsernameAndPasswordBC",
			promptType: "promptUserAndPass",
			titleIndex: 2,
			textIndex: 3,
			passwordObjectIndex: 5,
		},
		{
			name: "asyncPromptUsernameAndPassword",
			promptType: "promptUserAndPass",
			titleIndex: 2,
			textIndex: 3,
			passwordObjectIndex: 5,
		},
		{
			name: "promptPassword",
			promptType: "promptPassword",
			titleIndex: 1,
			textIndex: 2,
			passwordObjectIndex: 3,
		},
		{
			name: "promptPasswordBC",
			promptType: "promptPassword",
			titleIndex: 2,
			textIndex: 3,
			passwordObjectIndex: 4,
		},
		{
			name: "asyncPromptPassword",
			promptType: "promptPassword",
			titleIndex: 2,
			textIndex: 3,
			passwordObjectIndex: 4,
		},
		{
			name: "promptAuth",
			promptType: "promptUserAndPass",
			channelIndex: 1,
			authInfoIndex: 3,
			passwordObjectIndex: 3,
		},
		{
			name: "promptAuthBC",
			promptType: "promptUserAndPass",
			channelIndex: 2,
			authInfoIndex: 4,
			passwordObjectIndex: 4,
		},
		{
			name: "asyncPromptAuth",
			promptType: "promptUserAndPass",
			channelIndex: 1,
			authInfoIndex: 5,
			passwordObjectIndex: 5,
		},
		{
			name: "asyncPromptAuthBC",
			promptType: "promptUserAndPass",
			channelIndex: 2,
			authInfoIndex: 6,
			passwordObjectIndex: 6,
		},
	];
	initPromptFunctions(promptFunctions, Prompter.prototype);
	registerPromptFunctions(promptFunctions);
}
catch (error){
	console.log("KeePassXC-Mail: unable to change Prompter:", error);
}

try {
	// intercept password prompt for calendar
	const { calauth } = function(){
		try {
			return ChromeUtils.import("resource://calendar/utils/calAuthUtils.jsm");
		}
		catch (error){
			return ChromeUtils.import("resource:///modules/calendar/utils/calAuthUtils.jsm");
		}
	}();
	
	const { cal } = function(){
		try {
			return ChromeUtils.import("resource://calendar/modules/calUtils.jsm");
		}
		catch (error){
			return ChromeUtils.import("resource:///modules/calendar/calUtils.jsm");
		}
	}();
	
	const promptFunctions = [
		{
			name: "promptAuth",
			promptType: "promptUserAndPass",
			dataFunction: function(args){
				return {
					host: args[0].URI.spec,
					login: cal.auth.containerMap.getUsernameForUserContextId(
						args[0].loadInfo.originAttributes.userContextId
					),
					realm: args[2].realm,
				};
			},
			// channelIndex: 0,
			// authInfoIndex: 2,
			setCredentials: function(args, username, password){
				args[2].username = username;
				args[2].password = password;
			},
			// passwordObjectIndex: 2,
		},
	];
	initPromptFunctions(promptFunctions, calauth.Prompt.prototype);
	registerPromptFunctions(promptFunctions);
}
catch (error){
	console.log("KeePassXC-Mail: unable to change calauth.Prompt", error);
}

function getCredentialInfo(window){
	const promptType = window.args.promptType;
	if (["promptPassword", "promptUserAndPass"].indexOf(promptType) === -1){
		return false;
	}
	
	const promptData = currentPromptData || getCredentialInfoFromStrings(window.args.title, window.args.text);
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
windowListeners.push({
	name: "passwordDialogListener",
	chromeURLs: [
		"chrome://global/content/commonDialog.xul",
		"chrome://global/content/commonDialog.xhtml",
	],
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
	const { cal } = function(){
		try {
			return ChromeUtils.import("resource://calendar/modules/calUtils.jsm");
		}
		catch (error){
			return ChromeUtils.import("resource:///modules/calendar/calUtils.jsm");
		}
	}();
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
		chromeURLs: [
			"chrome://gdata-provider/content/browserRequest.xul",
			"chrome://messenger/content/browserRequest.xhtml"
		],
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
				credentialInfo.callback = (stored) => {
					if (!stored){
						originalPasswordManagerSave.call(this, login, password, host, realm);
					}
				};
				passwordEmitter.emit("password", credentialInfo);
				return false;
			}
			
			return originalPasswordManagerSave.call(this, login, password, host, realm);
		};
	};
	const restorePasswordManager = function restorePasswordManager(){
		cal.auth.passwordManagerGet = originalPasswordManagerGet;
		cal.auth.passwordManagerSave = originalPasswordManagerSave;
	};
	setupFunctions.push({
		setup: changePasswordManager,
		shutdown: restorePasswordManager
	});
}
catch (error){
	console.log("KeePassXC-Mail: unable to register support for gdata", error);
}

try {
	const { OAuth2Module } = ChromeUtils.import("resource:///modules/OAuth2Module.jsm");
	const originalRefreshTokenDescriptor = Object.getOwnPropertyDescriptor(OAuth2Module.prototype, "refreshToken");
	const alteredRefreshTokenDescriptor = Object.create(originalRefreshTokenDescriptor);
	alteredRefreshTokenDescriptor.get = function(){
		const credentials = waitForCredentials({
			login: this._username,
			host: this._loginOrigin
		});
		if (
			credentials &&
			credentials.credentials.length &&
			(typeof credentials.credentials[0].password) === "string"
		){
			return credentials.credentials[0].password;
		}
		return originalRefreshTokenDescriptor.get.call(this);
	};
	// alteredRefreshTokenDescriptor.set = function(refreshToken){
	// 	passwordEmitter.emit("password", {
	// 		login: this._username,
	// 		password: refreshToken,
	// 		host: this._loginOrigin
	// 	});
	// 	return originalRefreshTokenDescriptor.set.call(this, refreshToken);
	// };
	setupFunctions.push({
		setup: function(){
			Object.defineProperty(OAuth2Module.prototype, "refreshToken", alteredRefreshTokenDescriptor);
		},
		shutdown: function(){
			Object.defineProperty(OAuth2Module.prototype, "refreshToken", originalRefreshTokenDescriptor);
		}
	});
}
catch (error){
	console.log("KeePassXC-Mail: unable to register support for oauth", error);
}

try {
	const { cardbookRepository } = ChromeUtils.import("chrome://cardbook/content/cardbookRepository.js");
	const originalGetPassword = cardbookRepository.cardbookPasswordManager.getPassword;
	const alteredGetPassword =  function(username, url){
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
	const originalRememberPassword = cardbookRepository.cardbookPasswordManager.rememberPassword;
	const alteredRememberPassword =  function(username, url, password, save){
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
	setupFunctions.push({
		setup: function(){
			cardbookRepository.cardbookPasswordManager.getPassword = alteredGetPassword;
			cardbookRepository.cardbookPasswordManager.rememberPassword = alteredRememberPassword;
		},
		shutdown: function(){
			cardbookRepository.cardbookPasswordManager.getPassword = originalGetPassword;
			cardbookRepository.cardbookPasswordManager.rememberPassword = originalRememberPassword;
		}
	});
}
catch (error){
	console.log("KeePassXC-Mail: unable to register support for CardBook", error);
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
	data.openChoiceDialog = true;
	requestCredentials(data).then(function(credentialDetails){
		finished = true;
		returnValue = credentialDetails;
		return returnValue;
	}).catch(function(){
		finished = true;
	});

	if (Services.tm.spinEventLoopUntilOrShutdown){
		Services.tm.spinEventLoopUntilOrShutdown(() => finished);
	}
	else if (Services.tm.spinEventLoopUntilOrQuit){
		Services.tm.spinEventLoopUntilOrQuit("keepassxc-mail:waitForCredentials", () => finished);
	}
	else {
		console.error("Unable to wait for credentials!");
	}
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
	description.setAttribute("tooltiptext", getTranslation("credentialInfo", credentialInfo));
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