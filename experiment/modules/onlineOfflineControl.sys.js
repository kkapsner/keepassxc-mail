/* globals ChromeUtils */
import { log } from "./log.sys.js";
import { Services } from "./Services.sys.js";
import { OfflineStartup } from "resource:///modules/OfflineStartup.sys.mjs";
import { addSetup } from "./setup.sys.js";

// online/offline control
const ALWAYS_OFFLINE = 3;
const topics = [
	"profile-change-net-teardown",
	"quit-application-granted", "quit-application",
];
class ShutdownObserver{
	QueryInterface = ChromeUtils.generateQI(["nsIObserver"]);
	
	startObserving(){
		topics.forEach((topic) => {
			log("start observing", topic);
			try {
				Services.obs.addObserver(this, topic);
			}
			catch (error){
				log("unable to observer", topic, error, error.stack);
			}
		});
	}
	stopObserving(){
		topics.forEach((topic) => {
			Services.obs.removeObserver(this, topic);
		});
	}
	
	save(){
		if (Services.prefs.prefHasUserValue("keepassxc-mail.offline.startup_state")){
			log("Startup online state already saved - do not overwrite");
			return;
		}
		const valueToSave = Services.prefs.getIntPref("offline.startup_state");
		log("Saving startup online state:", valueToSave);
		Services.prefs.setIntPref(
			"keepassxc-mail.offline.startup_state",
			valueToSave
		);
	}
	setOfflineStartup(){
		log("Set to offline startup");
		Services.prefs.setIntPref(
			"offline.startup_state",
			ALWAYS_OFFLINE
		);
	}
	restore(){
		log("Restoring startup online state");
		this.restore = () => {};
		if (Services.prefs.prefHasUserValue("keepassxc-mail.offline.startup_state")){
			const storedValue = Services.prefs.getIntPref("keepassxc-mail.offline.startup_state");
			log("keepassxc-mail.offline.startup_state:", storedValue);
			log("offline.startup_state:", Services.prefs.getIntPref("offline.startup_state"));
			Services.prefs.setIntPref(
				"offline.startup_state",
				storedValue
			);
			Services.prefs.clearUserPref("keepassxc-mail.offline.startup_state");
			
			if (storedValue === ALWAYS_OFFLINE){
				log("Offline startup -> do nothing");
				return;
			}
			
			log("Calling OfflineStartup.prototype.onProfileStartup");
			OfflineStartup.prototype.onProfileStartup();
			
			if (Services.prefs.getBoolPref("offline.autoDetect")){
				log("auto detect: need to test for online state");
				Services.io.offline = false;
				Services.io.manageOfflineStatus = Services.prefs.getBoolPref(
					"offline.autoDetect"
				);
			}
		}
	}
	
	observe(_subject, topic, _data){
		log("observed", _subject, topic, _data);
		if (
			Services.prefs.prefHasUserValue("keepassxc-mail.offline_control") &&
			Services.prefs.getBoolPref("keepassxc-mail.offline_control")
		){
			this.save();
			this.setOfflineStartup();
		}
		else {
			log(
				"Startup offline control not activated. " +
				"Set the boolean keepassxc-mail.offline_control to true to enable it."
			);
		}
		this.stopObserving();
	}
}
const shutdownObserver = new ShutdownObserver();

addSetup({
	setup: function(){
		shutdownObserver.restore();
		shutdownObserver.startObserving();
	},
	shutdown: function(){
		shutdownObserver.stopObserving();
	}
});