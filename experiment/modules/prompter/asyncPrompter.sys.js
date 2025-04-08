import { initPromptFunctions, registerPromptFunctions } from "./utils.sys.js";
import { MsgAuthPrompt } from "resource:///modules/MsgAsyncPrompter.sys.mjs";

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