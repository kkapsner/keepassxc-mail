/* globals Components, Localization */
import { log } from "./log.sys.js";

export const {getCredentialInfoFromStrings, getCredentialInfoFromStringsAndProtocol, addDialogType} = function(){
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
			return {bundleName, stringName, replace: () => "", indexOf: () => -1, notFound: true};
		}
	}
	function getDialogType({
		protocol, title, titleRegExp, dialog, hostPlaceholder, loginPlaceholder, otherPlaceholders, noLoginRequired
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
			noLoginRequired,
			createTypeWithProtocolInTitle: function(){
				const newTitle = title + ` (${protocol})`;
				const withTitleType = addDialogType({
					protocol, title: newTitle, titleRegExp, dialog,
					hostPlaceholder, loginPlaceholder, otherPlaceholders,
					noLoginRequired
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
	["ldaps", "ldap"].forEach(function(protocol){
		addDialogType({
			protocol,
			title:  getBundleString("ldap", "authPromptTitle"),
			dialog: getBundleString("ldap", "authPromptText"),
			hostPlaceholder: "%1$S",
			loginPlaceholder: "",
			noLoginRequired: true,
		});
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
			loginPlaceholder: "",
			noLoginRequired: true,
		});
		masterType.forcedHost = "masterPassword://Thunderbird";
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
			addDialogType({
				protocol: "openpgp",
				title,
				dialog,
				hostPlaceholder: "%1$S",
				// loginPlaceholder: "%2$S",
				otherPlaceholders: ["%2$S", "%3$S", "%4$S"],
				noLoginRequired: true,
			});
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