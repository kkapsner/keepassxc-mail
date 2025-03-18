/* globals ChromeUtils, Components, XPCOMUtils, Localization, globalThis*/
/* eslint eslint-comments/no-use: off */
/* eslint {"indent": ["error", "tab", {"SwitchCase": 1, "outerIIFEBody": 0}]}*/
"use strict";
((exports) => {
function importModule(path, addExtension = true){
	if (ChromeUtils.import){
		return ChromeUtils.import(path + (addExtension? ".jsm": ""));
	}
	else if (ChromeUtils.importESModule){
		return ChromeUtils.importESModule(path + (addExtension? ".sys.mjs": ""));
	}
	else {
		throw "Unable to import module " + path;
	}
}
const { ExtensionCommon } = importModule("resource://gre/modules/ExtensionCommon");
const { ExtensionSupport } = importModule("resource:///modules/ExtensionSupport");
const { ExtensionParent } = importModule("resource://gre/modules/ExtensionParent");
const Services = function(){
	let Services;
	try {
		Services = globalThis.Services;
	}
	// eslint-disable-next-line no-empty
	catch (error){}
	return Services || importModule("resource://gre/modules/Services").Services;
}();
const { clearTimeout, setTimeout } = importModule("resource://gre/modules/Timer");
XPCOMUtils.defineLazyGlobalGetters(this, ["Localization"]);

const extension = ExtensionParent.GlobalManager.getExtension("keepassxc-mail@kkapsner.de");
function log(...args){
	console.log("KeePassXC-Mail:", ...args);
}
const windowListeners = [];
const setupFunctions = [];
const passwordEmitter = new ExtensionCommon.EventEmitter();

try {
	// online/offline control
	const ALWAYS_OFFLINE = 3;
	const topics = [
		"profile-change-net-teardown",
		"quit-application-granted", "quit-application",
	];
	class ShutdownObserver{
		QueryInterface = ChromeUtils.generateQI(["nsIObserver"]);
		
		startObserving(){
			topics.forEach((topic) => {
				log("start observing", topic);
				try {
					Services.obs.addObserver(this, topic);
				}
				catch (error){
					log("unable to observer", topic, error, error.stack);
				}
			});
		}
		stopObserving(){
			topics.forEach((topic) => {
				Services.obs.removeObserver(this, topic);
			});
		}
		
		save(){
			if (Services.prefs.prefHasUserValue("keepassxc-mail.offline.startup_state")){
				log("Startup online state already saved - do not overwrite");
				return;
			}
			const valueToSave = Services.prefs.getIntPref("offline.startup_state");
			log("Saving startup online state:", valueToSave);
			Services.prefs.setIntPref(
				"keepassxc-mail.offline.startup_state",
				valueToSave
			);
		}
		setOfflineStartup(){
			log("Set to offline startup");
			Services.prefs.setIntPref(
				"offline.startup_state",
				ALWAYS_OFFLINE
			);
		}
		restore(){
			log("Restoring startup online state");
			this.restore = () => {};
			if (Services.prefs.prefHasUserValue("keepassxc-mail.offline.startup_state")){
				const storedValue = Services.prefs.getIntPref("keepassxc-mail.offline.startup_state");
				log("keepassxc-mail.offline.startup_state:", storedValue);
				log("offline.startup_state:", Services.prefs.getIntPref("offline.startup_state"));
				Services.prefs.setIntPref(
					"offline.startup_state",
					storedValue
				);
				Services.prefs.clearUserPref("keepassxc-mail.offline.startup_state");
				
				if (storedValue === ALWAYS_OFFLINE){
					log("Offline startup -> do nothing");
					return;
				}
				
				const {OfflineStartup} = importModule("resource:///modules/OfflineStartup");
				log("Calling OfflineStartup.prototype.onProfileStartup");
				OfflineStartup.prototype.onProfileStartup();
				
				if (Services.prefs.getBoolPref("offline.autoDetect")){
					log("auto detect: need to test for online state");
					Services.io.offline = false;
					Services.io.manageOfflineStatus = Services.prefs.getBoolPref(
						"offline.autoDetect"
					);
				}
			}
		}
		
		observe(_subject, topic, _data){
			log("observed", _subject, topic, _data);
			if (
				Services.prefs.prefHasUserValue("keepassxc-mail.offline_control") &&
				Services.prefs.getBoolPref("keepassxc-mail.offline_control")
			){
				this.save();
				this.setOfflineStartup();
			}
			else {
				log(
					"Startup offline control not activated. " +
					"Set the boolean keepassxc-mail.offline_control to true to enable it."
				);
			}
			this.stopObserving();
		}
	}
	const shutdownObserver = new ShutdownObserver();

	setupFunctions.push({
		setup: function(){
			shutdownObserver.restore();
			shutdownObserver.startObserving();
		},
		shutdown: function(){
			shutdownObserver.stopObserving();
		}
	});
}
catch (error){
	log("unable to set up shutdown observer", error);
}

const {getCredentialInfoFromStrings, getCredentialInfoFromStringsAndProtocol, addDialogType} = function(){
	const stringBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"]
		.getService(Components.interfaces.nsIStringBundleService);
	
	const bundles = {
		commonDialog: stringBundleService.createBundle("chrome://global/locale/commonDialogs.properties"),
		compose: stringBundleService.createBundle("chrome://messenger/locale/messengercompose/composeMsgs.properties"),
		imap: stringBundleService.createBundle("chrome://messenger/locale/imapMsgs.properties"),
		ldap: stringBundleService.createBundle("chrome://mozldap/locale/ldap.properties"),
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
			log("unable to get", stringName, "from bundle", bundleName);
			return {bundleName, stringName, replace: ()=>{}, notFound: true};
		}
	}
	function getDialogType({
		protocol, title, titleRegExp, dialog, hostPlaceholder, loginPlaceholder, otherPlaceholders
	}){
		if (Array.isArray(title)){
			title = getBundleString(...title);
		}
		if (Array.isArray(dialog)){
			dialog = getBundleString(...dialog);
		}
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
			useable: !title.notFound && !dialog.notFound,
			protocol,
			title: titleRegExp?
				new RegExp(title.replace(/([\\+*?[^\]$(){}=!|.])/g, "\\$1").replace(/%(?:\d+\\\$)?S/, ".+")):
				title,
			dialog,
			dialogRegExp,
			hostGroup: hostPosition === -1? false: loginPosition === -1 || loginPosition > hostPosition? 1: 2,
			loginGroup: loginPosition === -1? false: hostPosition === -1 || hostPosition > loginPosition? 1: 2,
			otherProtocolExists: false,
			createTypeWithProtocolInTitle: function(){
				const newTitle = title + ` (${protocol})`;
				addDialogType({
					protocol, title: newTitle, titleRegExp, dialog, hostPlaceholder, loginPlaceholder, otherPlaceholders
				});
				this.createTypeWithProtocolInTitle = () => {};
			},
		};
	}
	function addDialogType(data){
		const dialogType = getDialogType(data);
		if (dialogType.useable){
			dialogTypes.some(function(otherDialogType){
				if (
					otherDialogType.protocol !== dialogType.protocol &&
					otherDialogType.title.toString() === dialogType.title.toString() &&
					otherDialogType.dialogRegExp.toString() === dialogType.dialogRegExp.toString()
				){
					if (!otherDialogType.otherProtocolExists){
						otherDialogType.createTypeWithProtocolInTitle();
					}
					otherDialogType.otherProtocolExists = true;
					dialogType.createTypeWithProtocolInTitle();
					dialogType.otherProtocolExists = true;
					return true;
				}
				return false;
			});
			dialogTypes.push(dialogType);
		}
		else {
			// log("Not useable dialog type:", data);
		}
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
		protocol: "ldap",
		title:  getBundleString("ldap", "authPromptTitle"),
		dialog: getBundleString("ldap", "authPromptText"),
		hostPlaceholder: "%1$S",
		loginPlaceholder: ""
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
		const title = pgpI10n.formatValueSync("openpgp-passphrase-prompt-title");
		const dialogs = [pgpI10n.formatValueSync("openpgp-passphrase-prompt", {key: "%1$S, %2$S, %3$S"})];
		const pgpI10n2 = new Localization(["messenger/openpgp/openpgp.ftl"], true);
		if (pgpI10n2){
			["passphrase-prompt2-sub", "passphrase-prompt2"].forEach(function(id){
				dialogs.push(pgpI10n2.formatValueSync(id, {
					subkey: "%2$S",
					key: "%1$S",
					date: "%3$S",
					username_and_email: "%4$S",
				}));
			});
		}
		
		dialogs.filter(function(dialog){return dialog;}).forEach(function(dialog){
			const openPGPType = addDialogType({
				protocol: "openpgp",
				title,
				dialog,
				hostPlaceholder: "%1$S",
				// loginPlaceholder: "%2$S",
				otherPlaceholders: ["%2$S", "%3$S", "%4$S"]
			});
			openPGPType.noLoginRequired = true;
		});
	}
	
	function getCredentialInfos(dialogTypes, title, text){
		const credentialInfos = dialogTypes.filter(function(dialogType){
			return dialogType.title === title || (dialogType.title.test && dialogType.title.test(title));
		}).map(function(dialogType){
			const ret = Object.create(dialogType);
			ret.match = text.match(dialogType.dialogRegExp);
			return ret;
		}).filter(function(dialogType){
			return dialogType.match;
		}).map(function(type){
			const host = type.hostGroup?
				(
					(type.protocol? type.protocol + "://": "") +
					type.match[type.hostGroup]
				): type.forcedHost || false;
			let login = type.loginGroup?
				type.match[type.loginGroup]:
				type.noLoginRequired || false;
			return {host, login, mayAddProtocol: type.otherProtocolExists};
		}).filter(function(credentialInfo, index, credentialInfos){
			for (let i = 0; i < index; i += 1){
				if (
					credentialInfos[i].host === credentialInfo.host ||
					credentialInfos[i].login === credentialInfo.login
				){
					return false;
				}
			}
			return true;
		});
		if (credentialInfos.length){
			return credentialInfos[0];
		}
		return false;
	}
	
	return {
		getCredentialInfoFromStrings: function getCredentialInfoFromStrings(title, text){
			return getCredentialInfos(dialogTypes.filter(function(dialogType){
				return !dialogType.otherProtocolExists;
			}), title, text);
		},
		getCredentialInfoFromStringsAndProtocol:
		function getCredentialInfoFromStringsAndProtocol(title, text, knownProtocol){
			return getCredentialInfos(dialogTypes.filter(function(dialogType){
				return dialogType.protocol === knownProtocol;
			}), title, text);
		},
		addDialogType
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
	const promptDataFunctions = [];
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
			const {host: stringHost, login: stringLogin, mayAddProtocol} = getCredentialInfoFromStringsAndProtocol(
				args[promptFunction.titleIndex],
				args[promptFunction.textIndex],
				protocol
			);
			return {
				mayAddProtocol,
				protocol,
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
		if (
			data &&
			(
				promptFunction.hasOwnProperty("passwordObjectIndex") ||
				promptFunction.setCredentials
			)
		){
			const { credentials } = waitForCredentials({
				host: data.host,
				login: data.login,
				loginChangeable: promptFunction.loginChangeable,
			});
			if (credentials.length === 1){
				if (promptFunction.setCredentials){
					promptFunction.setCredentials(args, credentials[0].login, credentials[0].password);
				}
				else {
					args[promptFunction.passwordObjectIndex].value = credentials[0].password;
				}
				
				if (promptFunction.hasOwnProperty("savePasswordIndex")){
					args[promptFunction.savePasswordIndex].value = false;
				}
				return true;
			}
			if (data.mayAddProtocol && promptFunction.hasOwnProperty("titleIndex")){
				args[promptFunction.titleIndex] += ` (${data.protocol})`;
			}
		}
		const ret = promptFunction.original.call(this, ...args);
		return ret;
	};
}

function initPromptFunctions(promptFunctions, object){
	promptFunctions.forEach(function(promptFunction){
		initPromptFunction(promptFunction, object);
	});
}

try {
	const { MsgAuthPrompt } = importModule("resource:///modules/MsgAsyncPrompter");
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
			name: "promptUsernameAndPassword",
			promptType: "promptUserAndPass",
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
			name: "promptPassword2",
			promptType: "promptPassword",
			titleIndex: 0,
			textIndex: 1,
			passwordObjectIndex: 2,
			savePasswordIndex: 4,
		},
		{
			name: "promptAuth",
			promptType: "promptUserAndPass",
			dataFunction: function(args){
				return {
					host: `${args[0].URI.scheme}://${args[0].URI.host}`,
					login: args[2].username,
				};
			},
			// channelIndex: 0,
			// authInfoIndex: 2,
			setCredentials: function(args, username, password){
				args[2].username = username;
				args[2].password = password;
			},
			// passwordObjectIndex: 2,
			savePasswordIndex: 4,
		},
	];
	initPromptFunctions(promptFunctions, MsgAuthPrompt.prototype);
	registerPromptFunctions(promptFunctions);
}
catch (error){
	log("unable to change MsgAuthPrompt:", error);
}

try {
	const { LoginManagerAuthPrompter } = importModule("resource://gre/modules/LoginManagerAuthPrompter");
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
	log("unable to change LoginManagerAuthPrompter:", error);
}

try {
	const { Prompter } = importModule("resource://gre/modules/Prompter");
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
	log("unable to change Prompter:", error);
}

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
	async function handleEvent(guiOperations, credentialInfo){
		if (guiOperations.doHandle && !(await guiOperations.doHandle())){
			return;
		}
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
			onLoadWindow: function(window){
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
			return importModule("resource://calendar/modules/calUtils");
		}
		catch (error){
			return importModule("resource:///modules/calendar/calUtils");
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
	log("unable to register support for gdata", error);
}

try {
	const { OAuth2Module } = importModule("resource:///modules/OAuth2Module");
	const temporaryCache = new Map();
	const getKey = function getKey(oAuth2Module){
		return oAuth2Module._username + "|" + oAuth2Module._loginOrigin;
	};
	const setCache = function setCache(key, value, timeout = 2000){
		if (temporaryCache.has(key)){
			clearTimeout(temporaryCache.get(key).timeout);
		}
		temporaryCache.set(key, {
			value,
			timeout: setTimeout(function(){
				temporaryCache.delete(key);
			}, timeout)
		});
	};
	const getRefreshToken = function getRefreshToken(tokenStore){
		const key = getKey(tokenStore);
		const cached = temporaryCache.get(key);
		if (cached){
			return cached.value;
		}
		const credentials = waitForCredentials({
			login: tokenStore._username,
			host: tokenStore._loginOrigin
		});
		if (
			credentials &&
			credentials.credentials.length &&
			(typeof credentials.credentials[0].password) === "string"
		){
			setCache(key, credentials.credentials[0].password);
			return credentials.credentials[0].password;
		}
		return null;
	};
	const setRefreshToken = function setRefreshToken(tokenStore, refreshToken){
		if (refreshToken === getRefreshToken(tokenStore)){
			return true;
		}
		setCache(getKey(tokenStore), refreshToken, 5000);
		const stored = waitForPasswordStore({
			login: tokenStore._username,
			password: refreshToken,
			host: tokenStore._loginOrigin,
		});
		return stored;
	};
	if (OAuth2Module.prototype.hasOwnProperty("getRefreshToken")){
		const originalGetRefreshToken = OAuth2Module.prototype.getRefreshToken;
		const alteredGetRefreshToken = function(){
			const token = getRefreshToken(this);
			if (token !== null){
				return token;
			}
			return originalGetRefreshToken.call(this);
		};
		setupFunctions.push({
			setup: function(){
				OAuth2Module.prototype.getRefreshToken = alteredGetRefreshToken;
			},
			shutdown: function(){
				OAuth2Module.prototype.getRefreshToken = originalGetRefreshToken;
			}
		});
	}
	if (OAuth2Module.prototype.hasOwnProperty("setRefreshToken")){
		const originalSetRefreshToken = OAuth2Module.prototype.setRefreshToken;
		const alteredSetRefreshToken = async function(refreshToken){
			const stored = setRefreshToken(this, refreshToken);
			if (!stored){
				return originalSetRefreshToken.call(this, refreshToken);
			}
			return refreshToken;
		};
		setupFunctions.push({
			setup: function(){
				OAuth2Module.prototype.setRefreshToken = alteredSetRefreshToken;
			},
			shutdown: function(){
				OAuth2Module.prototype.setRefreshToken = originalSetRefreshToken;
			}
		});
	}
	
	const { OAuth2 } = importModule("resource:///modules/OAuth2");
	if (OAuth2 && OAuth2.prototype.hasOwnProperty("connect")){
		const getUsername = function getUsername(oAuth){
			if (!oAuth){
				return false;
			}
			if (oAuth.username){
				return oAuth.username;
			}
			if (!Array.isArray(oAuth.extraAuthParams)){
				return false;
			}
			for (let i = 0; i + 1 < oAuth.extraAuthParams.length; i += 2){
				if (oAuth.extraAuthParams[i] === "login_hint"){
					return oAuth.extraAuthParams[i + 1];
				}
			}
			return false;
		};
		const updateRefreshToken = function updateRefreshToken(oAuth){
			const username = getUsername(oAuth);
			if (!username){
				return false;
			}
			const authorizationEndpointURL = Services.io.newURI(oAuth.authorizationEndpoint);
			const refreshToken = getRefreshToken({
				_username: username,
				_loginOrigin: "oauth://" + authorizationEndpointURL.host
			});
			if (refreshToken !== null){
				oAuth.refreshToken = refreshToken;
				return true;
			}
			return false;
		};
		
		const originalConnect = OAuth2.prototype.connect;
		const alteredConnect = async function(...args){
			if (!this.refreshToken){
				updateRefreshToken(this);
			}
			return originalConnect.call(this, ...args);
		};
		setupFunctions.push({
			setup: function(){
				OAuth2.prototype.connect = alteredConnect;
			},
			shutdown: function(){
				OAuth2.prototype.connect = originalConnect;
			}
		});
	}
	if (OAuth2Module.prototype.hasOwnProperty("refreshToken")){
		const originalRefreshTokenDescriptor = Object.getOwnPropertyDescriptor(OAuth2Module.prototype, "refreshToken");
		const alteredRefreshTokenDescriptor = Object.create(originalRefreshTokenDescriptor);
		alteredRefreshTokenDescriptor.get = function(){
			const refreshToken = getRefreshToken(this);
			if (refreshToken !== null){
				return refreshToken;
			}
			return originalRefreshTokenDescriptor.get.call(this);
		};
		alteredRefreshTokenDescriptor.set = function(refreshToken){
			const stored = setRefreshToken(this, refreshToken);
			if (!stored){
				return originalRefreshTokenDescriptor.set.call(this, refreshToken);
			}
			return refreshToken;
		};
		setupFunctions.push({
			setup: function(){
				Object.defineProperty(OAuth2Module.prototype, "refreshToken", alteredRefreshTokenDescriptor);
			},
			shutdown: function(){
				Object.defineProperty(OAuth2Module.prototype, "refreshToken", originalRefreshTokenDescriptor);
			}
		});
	}
}
catch (error){
	log("unable to register support for oauth", error);
}

const cardBookExtension = ExtensionParent.GlobalManager.getExtension("cardbook@vigneau.philippe");
if (cardBookExtension){
	console.log(addDialogType({
		protocol: false,
		title: cardBookExtension.localeData.localizeMessage("wdw_passwordMissingTitle"),
		dialog: ["commonDialog", "EnterPasswordFor"],
		hostPlaceholder: "%2$S",
		loginPlaceholder: "%1$S"
	}));
	
	let tries = 0;
	const loadCardbookPasswordManager = function loadCardbookPasswordManager(){
		try {
			const { cardbookXULPasswordManager } = importModule(
				"chrome://cardbook/content/XUL/utils/cardbookXULPasswordManager.js",
				false
			);
			return cardbookXULPasswordManager;
		}
		catch (error){
			log("loading cardbookXULPasswordManager failed:", error);
			log("try loading cardbookRepository");
			const { cardbookRepository } = importModule("chrome://cardbook/content/cardbookRepository.js", false);
			return cardbookRepository.cardbookPasswordManager;
		}
	};
	const registerCardbook = function registerCardbook(){
		tries += 1;
		try {
			log("try to register cardbook");
			const { cardbookXULPasswordManager } = importModule(
				"chrome://cardbook/content/XUL/utils/cardbookXULPasswordManager.js",
				false
			);
			const passwordManager = loadCardbookPasswordManager();
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
			const setupFunction = {
				setup: function(){
					passwordManager.getPassword = alteredGetPassword;
					passwordManager.rememberPassword = alteredRememberPassword;
				},
				shutdown: function(){
					passwordManager.getPassword = originalGetPassword;
					passwordManager.rememberPassword = originalRememberPassword;
				}
			};
			setupFunctions.push(setupFunction);
			if (setupFunctions.setup){
				setupFunction.setup();
			}
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

const passwordRequestEmitter = new class extends ExtensionCommon.EventEmitter {
	constructor(){
		super();
		this.callbackCount = 0;
	}

	add(callback){
		this.on("password-requested", callback);
		this.callbackCount++;

		if (this.callbackCount === 1){
			setupFunctions.forEach(function(setupFunction){
				setupFunction.setup();
			});
			setupFunctions.setup = true;
		}
	}

	remove(callback){
		this.off("password-requested", callback);
		this.callbackCount--;

		if (this.callbackCount === 0){
			log("Last password request emitter removed -> shutdown experiment");
			setupFunctions.forEach(function(setupFunction){
				setupFunction.shutdown();
			});
			setupFunctions.setup = false;
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

function waitForPromise(promise, defaultValue){
	let finished = false;
	let returnValue = defaultValue;
	promise.then(function(value){
		finished = true;
		returnValue = value;
		return returnValue;
	}).catch(function(){
		finished = true;
	});

	if (Services.tm.spinEventLoopUntilOrShutdown){
		Services.tm.spinEventLoopUntilOrShutdown(() => finished);
	}
	else if (Services.tm.spinEventLoopUntilOrQuit){
		Services.tm.spinEventLoopUntilOrQuit("keepassxc-mail:waitForPromise", () => finished);
	}
	else {
		console.error("Unable to wait for promise!");
	}
	return returnValue;
}

function waitForCredentials(data){
	data.openChoiceDialog = true;
	return waitForPromise(requestCredentials(data), false);
}

function waitForPasswordStore(data){
	return waitForPromise(passwordEmitter.emit("password", data), []).reduce(function(alreadyStored, stored){
		return alreadyStored || stored;
	}, false);
}

function getTranslation(name, variables){
	const translation = extension.localeData.localizeMessage(name) || name;
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

exports.credentials = class extends ExtensionCommon.ExtensionAPI {
	getAPI(context){
		return {
			credentials: {
				onCredentialRequested: new ExtensionCommon.EventManager({
					context,
					name: "credentials.onCredentialRequested",
					register(fire){
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
						return function(){
							passwordRequestEmitter.remove(callback);
						};
					},
				}).api(),
				onNewCredential: new ExtensionCommon.EventManager({
					context,
					name: "credentials.onNewCredential",
					register(fire){
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
						return function(){
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
	if (checkbox?.checked){
		checkbox.click();
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
	if (!(row && box && description)){
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
})(this);