import { OAuth2 } from "resource:///modules/OAuth2.sys.mjs";
import { getRefreshToken } from "./oauth2Module.sys.js";
import { Services } from "../Services.sys.js";
import { addSetup } from "../setup.sys.js";

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
	const updateRefreshToken = function updateRefreshToken(oAuth){
		const username = getUsername(oAuth);
		if (!username){
			return false;
		}
		const authorizationEndpointURL = Services.io.newURI(oAuth.authorizationEndpoint);
		const refreshToken = getRefreshToken({
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
			updateRefreshToken(this);
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