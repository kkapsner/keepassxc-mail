import { initPromptFunctions, registerPromptFunctions } from "./utils.sys.mjs";
import { LoginManagerAuthPrompter } from "resource://gre/modules/LoginManagerAuthPrompter.sys.mjs";

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