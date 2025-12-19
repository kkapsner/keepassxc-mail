/* globals Services, Ci */
import { initPromptFunctions, registerPromptFunctions } from "./utils.sys.js";
import { LoginManagerAuthPrompter } from "resource://gre/modules/LoginManagerAuthPrompter.sys.mjs";
import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";

const promptFunctions = [
	{
		name: "asyncPromptPassword",
		isAsync: true,
		promptType: "promptPassword",
		titleIndex: 0,
		textIndex: 1,
		realmIndex: 2,
		savePasswordIndex: 3,
		savePasswordValue: Ci.nsIAuthPrompt.SAVE_PASSWORD_NEVER,
		passwordObjectIndex: 4,
		createReturnValue: Services.vc.compare(AppConstants.MOZ_APP_VERSION, "148.0a1") >= 0 && function(credentials){
			return {
				ok: !!credentials,
				password: credentials? credentials.password: ""
			};
		},
	},
	{
		name: "asyncPromptUsernameAndPassword",
		isAsync: true,
		promptType: "promptUserAndPass",
		titleIndex: 0,
		textIndex: 1,
		realmIndex: 2,
		savePasswordIndex: 3,
		savePasswordValue: Ci.nsIAuthPrompt.SAVE_PASSWORD_NEVER,
		usernameObjectIndex: 4,
		passwordObjectIndex: 5,
		createReturnValue: Services.vc.compare(AppConstants.MOZ_APP_VERSION, "148.0a1") >= 0 && function(credentials){
			return {
				ok: !!credentials,
				username: credentials? credentials.login: "",
				password: credentials? credentials.password: ""
			};
		},
	},
	{
		name: "prompt",
		promptType: "promptPassword",
		titleIndex: 0,
		textIndex: 1,
		realmIndex: 2,
		savePasswordIndex: 3,
		savePasswordValue: Ci.nsIAuthPrompt.SAVE_PASSWORD_NEVER,
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
	},
];
initPromptFunctions(promptFunctions, LoginManagerAuthPrompter.prototype, "LoginManagerAuthPrompter");
registerPromptFunctions(promptFunctions);