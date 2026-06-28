/* globals Services */
import { OAuth2 } from "resource:///modules/OAuth2.sys.mjs";
import { getRefreshToken } from "./oauth2Module.sys.js";
import { addSetup } from "../setup.sys.js";
import { messageEmitter } from "../emitters.sys.js";

if (OAuth2.prototype.hasOwnProperty("connect")){
	const getUsername = function getUsername(oAuth){
		if (!oAuth){
			return false;
		}
		if (oAuth.username){
			return oAuth.username;
		}
		if (!Array.isArray(oAuth.extraAuthParams)){
			return false;
		}
		for (let i = 0; i + 1 < oAuth.extraAuthParams.length; i += 2){
			if (oAuth.extraAuthParams[i] === "login_hint"){
				return oAuth.extraAuthParams[i + 1];
			}
		}
		return false;
	};
	const updateRefreshToken = async function updateRefreshToken(oAuth){
		const username = getUsername(oAuth);
		if (!username){
			return false;
		}
		const authorizationEndpointURL = Services.io.newURI(oAuth.authorizationEndpoint);
		const refreshToken = await getRefreshToken({
			_username: username,
			_loginOrigin: "oauth://" + authorizationEndpointURL.host
		});
		if (refreshToken !== null){
			oAuth.refreshToken = refreshToken;
			return true;
		}
		return false;
	};
	
	const originalConnect = OAuth2.prototype.connect;
	const alteredConnect = async function(...args){
		if (!this.refreshToken){
			await updateRefreshToken(this);
		}
		return originalConnect.call(this, ...args);
	};
	addSetup({
		setup: function(){
			OAuth2.prototype.connect = alteredConnect;
		},
		shutdown: function(){
			OAuth2.prototype.connect = originalConnect;
		}
	});
}

addSetup({
	setup: async function checkOauthPreferences(){
		if (
			Services.prefs.prefHasDefaultValue("mailnews.oauth.useExternalBrowser") &&
			Services.prefs.getBoolPref("mailnews.oauth.useExternalBrowser")
		){
			const confirmations = await messageEmitter.emit("confirm", "updateExternalBrowserUsage");
			if (confirmations && confirmations.every(a => a)){
				Services.prefs.setBoolPref("mailnews.oauth.useExternalBrowser", false);
				Services.startup.quit(Services.startup.eForceQuit | Services.startup.eRestart);
			}
		}
	},
	shutdown: function(){}
});