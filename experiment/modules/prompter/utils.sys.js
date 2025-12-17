/* globals Services */
import { waitForPromise } from "../wait.sys.js";
import { requestCredentials } from "../credentials.sys.js";
import { log }  from "../log.sys.js";
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
			try {
				const uri = Services.io.newURI(realm);
				const protocol = uri.scheme === "mailbox"? "pop3": uri.scheme;
				const realmLogin = uri.username;
				const realmHost = protocol + "://" + uri.displayHostPort;
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
			}
			catch (error){
				log("Error retrieving realm data from", args, error);
				return false;
			}
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
	
	if (!promptFunction.original){
		log("Unable to find", promptFunction.name, "in", object);
		promptFunction.replacement = promptFunction.original;
		return;
	}
	
	const changedFunction = async function changedFunction(...args){
		if (promptFunction.hasOwnProperty("savePasswordIndex")){
			if (promptFunction.hasOwnProperty("savePasswordValue")){
				args[promptFunction.savePasswordIndex] = promptFunction.savePasswordValue;
			}
			else {
				args[promptFunction.savePasswordIndex].value = false;
			}
		}
		
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
			const { credentials } = await requestCredentials({
				openChoiceDialog: true,
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
				
				return true;
			}
			if (data.mayAddProtocol && promptFunction.hasOwnProperty("titleIndex")){
				args[promptFunction.titleIndex] += ` (${data.protocol})`;
			}
		}
		const ret = promptFunction.original.call(this, ...args);
		return ret;
	};
	
	promptFunction.replacement = promptFunction.isAsync? changedFunction: function(...args){
		return waitForPromise(changedFunction.call(this, ...args), false);
	};
}

export function initPromptFunctions(promptFunctions, object){
	promptFunctions.forEach(function(promptFunction){
		initPromptFunction(promptFunction, object);
	});
}