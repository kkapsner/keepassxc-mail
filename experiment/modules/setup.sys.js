import { log } from "./log.sys.js";
import { waitForPromise } from "./wait.sys.js";

const setupFunctions = [];
export function addSetup({setup, shutdown}){
	if (!setup){
		return;
	}
	if (setupFunctions.setup){
		setup();
	}
	setupFunctions.push({setup, shutdown});
}

const AsyncFunction = (async () => {}).constructor;
export function addReplacerSetup(object, replacements){
	replacements = replacements.filter(replacement => {
		if (!object.hasOwnProperty(replacement.name)){
			log("Unable to setup replacer for", replacement.name, "on", object);
		}
		return true;
	}).map(replacement => {
		replacement.original = object[replacement.name];
		const originalIsAsync = replacement.original instanceof AsyncFunction;
		const replacementIsAsync = replacement.replacement instanceof AsyncFunction;
		if (originalIsAsync === replacementIsAsync){
			return replacement;
		}
		
		const originalReplacement = replacement.replacement;
		if (originalIsAsync){
			replacement.replacement = async function(...args){
				return originalReplacement.call(this, ...args);
			};
		}
		if (replacementIsAsync){
			replacement.replacement = function(...args){
				return waitForPromise(originalReplacement.call(this, ...args), replacement.defaultReturn);
			};
		}
		return replacement;
	});
	
	addSetup({
		setup: function(){
			replacements.forEach(replacement => {
				object[replacement.name] = replacement.replacement;
			});
		},
		shutdown: function(){
			replacements.forEach(replacement => {
				object[replacement.name] = replacement.original;
			});
		}
	});
}

export function setup(){
	setupFunctions.forEach(function(setupFunction){
		setupFunction.setup();
	});
	setupFunctions.setup = true;
}

export function shutdown(){
	setupFunctions.forEach(function(setupFunction){
		setupFunction.shutdown();
	});
	setupFunctions.setup = false;
}