import { OAuth2Module } from "resource:///modules/OAuth2Module.sys.mjs";
import { clearTimeout, setTimeout } from "resource://gre/modules/Timer.sys.mjs";
import { waitForCredentials, waitForPasswordStore } from "../wait.sys.js";
import { addSetup } from "../setup.sys.js";

const temporaryCache = new Map();
const getKey = function getKey(oAuth2Module){
	return oAuth2Module._username + "|" + oAuth2Module._loginOrigin;
};
const setCache = function setCache(key, value, timeout = 2000){
	if (temporaryCache.has(key)){
		clearTimeout(temporaryCache.get(key).timeout);
	}
	temporaryCache.set(key, {
		value,
		timeout: setTimeout(function(){
			temporaryCache.delete(key);
		}, timeout)
	});
};
export const getRefreshToken = function getRefreshToken(tokenStore){
	const key = getKey(tokenStore);
	const cached = temporaryCache.get(key);
	if (cached){
		return cached.value;
	}
	const credentials = waitForCredentials({
		login: tokenStore._username,
		host: tokenStore._loginOrigin
	});
	if (
		credentials &&
		credentials.credentials.length &&
		(typeof credentials.credentials[0].password) === "string"
	){
		setCache(key, credentials.credentials[0].password);
		return credentials.credentials[0].password;
	}
	return null;
};
export const setRefreshToken = function setRefreshToken(tokenStore, refreshToken){
	if (refreshToken === getRefreshToken(tokenStore)){
		return true;
	}
	setCache(getKey(tokenStore), refreshToken, 5000);
	const stored = waitForPasswordStore({
		login: tokenStore._username,
		password: refreshToken,
		host: tokenStore._loginOrigin,
	});
	return stored;
};
if (OAuth2Module.prototype.hasOwnProperty("getRefreshToken")){
	const originalGetRefreshToken = OAuth2Module.prototype.getRefreshToken;
	const alteredGetRefreshToken = function(){
		const token = getRefreshToken(this);
		if (token !== null){
			return token;
		}
		return originalGetRefreshToken.call(this);
	};
	addSetup({
		setup: function(){
			OAuth2Module.prototype.getRefreshToken = alteredGetRefreshToken;
		},
		shutdown: function(){
			OAuth2Module.prototype.getRefreshToken = originalGetRefreshToken;
		}
	});
}
if (OAuth2Module.prototype.hasOwnProperty("setRefreshToken")){
	const originalSetRefreshToken = OAuth2Module.prototype.setRefreshToken;
	const alteredSetRefreshToken = async function(refreshToken){
		const stored = setRefreshToken(this, refreshToken);
		if (!stored){
			return originalSetRefreshToken.call(this, refreshToken);
		}
		return refreshToken;
	};
	addSetup({
		setup: function(){
			OAuth2Module.prototype.setRefreshToken = alteredSetRefreshToken;
		},
		shutdown: function(){
			OAuth2Module.prototype.setRefreshToken = originalSetRefreshToken;
		}
	});
}

if (OAuth2Module.prototype.hasOwnProperty("refreshToken")){
	const originalRefreshTokenDescriptor = Object.getOwnPropertyDescriptor(OAuth2Module.prototype, "refreshToken");
	const alteredRefreshTokenDescriptor = Object.create(originalRefreshTokenDescriptor);
	alteredRefreshTokenDescriptor.get = function(){
		const refreshToken = getRefreshToken(this);
		if (refreshToken !== null){
			return refreshToken;
		}
		return originalRefreshTokenDescriptor.get.call(this);
	};
	alteredRefreshTokenDescriptor.set = function(refreshToken){
		const stored = setRefreshToken(this, refreshToken);
		if (!stored){
			return originalRefreshTokenDescriptor.set.call(this, refreshToken);
		}
		return refreshToken;
	};
	addSetup({
		setup: function(){
			Object.defineProperty(OAuth2Module.prototype, "refreshToken", alteredRefreshTokenDescriptor);
		},
		shutdown: function(){
			Object.defineProperty(OAuth2Module.prototype, "refreshToken", originalRefreshTokenDescriptor);
		}
	});
}