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