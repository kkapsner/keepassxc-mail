/* globals Services */
import { waitForCredentials } from "../wait.sys.js";
import { getCredentialInfoFromStrings, getCredentialInfoFromStringsAndProtocol } from "../dialogStrings.sys.js";
import { addSetup } from "../setup.sys.js";

export function registerPromptFunctions(promptFunctions){
	addSetup({
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

export function initPromptFunctions(promptFunctions, object){
	promptFunctions.forEach(function(promptFunction){
		initPromptFunction(promptFunction, object);
	});
}