import { log } from "./log.sys.js";
import { ExtensionCommon } from "resource://gre/modules/ExtensionCommon.sys.mjs";
import { setup, shutdown } from "./setup.sys.js";

log("initializing emitters");

export const passwordEmitter = new ExtensionCommon.EventEmitter();

export const passwordRequestEmitter = new class extends ExtensionCommon.EventEmitter {
	constructor(){
		super();
		this.callbackCount = 0;
	}

	add(callback){
		this.on("password-requested", callback);
		this.callbackCount++;

		if (this.callbackCount === 1){
			setup();
		}
	}

	remove(callback){
		this.off("password-requested", callback);
		this.callbackCount--;

		if (this.callbackCount === 0){
			log("Last password request emitter removed -> shutdown experiment");
			shutdown();
		}
	}
};