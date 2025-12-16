/* globals Ci */
import { initPromptFunctions, registerPromptFunctions } from "./utils.sys.js";
import { LoginManagerAuthPrompter } from "resource://gre/modules/LoginManagerAuthPrompter.sys.mjs";

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
initPromptFunctions(promptFunctions, LoginManagerAuthPrompter.prototype);
registerPromptFunctions(promptFunctions);