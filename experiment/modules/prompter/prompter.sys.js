import { initPromptFunctions, registerPromptFunctions } from "./utils.sys.js";
import { Prompter } from "resource://gre/modules/Prompter.sys.mjs";
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