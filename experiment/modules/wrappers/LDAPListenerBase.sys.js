/* globals Services, Ci */
import { LDAPListenerBase } from "resource:///modules/LDAPListenerBase.sys.mjs";
import { LoginManagerAuthPrompter } from "resource://gre/modules/LoginManagerAuthPrompter.sys.mjs";
import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";
import { addSetup } from "../setup.sys.js";
import { log } from "../log.sys.js";


const originalOnLDAPInit = LDAPListenerBase.prototype.onLDAPInit;
const fixedOnLDAPInit = Services.vc.compare(AppConstants.MOZ_APP_VERSION, "148.0a1") >= 0?
	async function onLDAPInit() {
		let password = null;
		const outPassword = {value: null};
		if (this._directory.authDn && this._directory.saslMechanism !== "GSSAPI") {
			// If authDn is set, we're expected to use it to get a password.
			const bundle = Services.strings.createBundle(
				"chrome://mozldap/locale/ldap.properties"
			);

			const authPrompt = Services.ww.getNewAuthPrompter(
				Services.wm.getMostRecentWindow(null)
			);
			const result = await authPrompt.asyncPromptPassword(
				bundle.GetStringFromName("authPromptTitle"),
				bundle.formatStringFromName("authPromptText", [
					this._directory.lDAPURL.host,
				]),
				this._directory.lDAPURL.spec,
				Ci.nsIAuthPrompt.SAVE_PASSWORD_PERMANENTLY,
				{}
			);
			if (result.ok){
				password = result.password;
			}
		}
		this._operation.init(this._connection, this, null);

		if (this._directory.saslMechanism !== "GSSAPI") {
			this._operation.simpleBind(password);
			return;
		}

		// Handle GSSAPI now.
		this._operation.saslBind(
			`ldap@${this._directory.lDAPURL.host}`,
			"GSSAPI",
			"sasl-gssapi"
		);
	}:
	async function onLDAPInit() {
		const outPassword = {value: null};
		if (this._directory.authDn && this._directory.saslMechanism !== "GSSAPI") {
			// If authDn is set, we're expected to use it to get a password.
			const bundle = Services.strings.createBundle(
				"chrome://mozldap/locale/ldap.properties"
			);

			// const authPrompt = Services.ww.getNewAuthPrompter(
			// 	Services.wm.getMostRecentWindow(null)
			// );
			const authPrompt = LoginManagerAuthPrompter.prototype;
			await authPrompt.asyncPromptPassword(
				bundle.GetStringFromName("authPromptTitle"),
				bundle.formatStringFromName("authPromptText", [
					this._directory.lDAPURL.host,
				]),
				this._directory.lDAPURL.spec,
				Ci.nsIAuthPrompt.SAVE_PASSWORD_PERMANENTLY,
				outPassword
			);
		}
		this._operation.init(this._connection, this, null);

		if (this._directory.saslMechanism !== "GSSAPI") {
			this._operation.simpleBind(outPassword.value);
			return;
		}

		// Handle GSSAPI now.
		this._operation.saslBind(
			`ldap@${this._directory.lDAPURL.host}`,
			"GSSAPI",
			"sasl-gssapi"
		);
	};

function changeLDAPListenerBase(){
	LDAPListenerBase.prototype.onLDAPInit = fixedOnLDAPInit;
}
function restoreLDAPListenerBase(){
	LDAPListenerBase.prototype.onLDAPInit = originalOnLDAPInit;
}
if (Services.vc.compare(AppConstants.MOZ_APP_VERSION, "149.0a1") < 0){
	log("Fix LDAPListenerBase");
	addSetup({
		setup: changeLDAPListenerBase,
		shutdown: restoreLDAPListenerBase
	});
}
else {
	log("LDAPListenerBase fixed in version 149 - do not apply own fix");
}