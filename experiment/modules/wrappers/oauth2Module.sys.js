import { OAuth2Module } from "resource:///modules/OAuth2Module.sys.mjs";
import { clearTimeout, setTimeout } from "resource://gre/modules/Timer.sys.mjs";
import { requestCredentials, storeCredentials } from "../credentials.sys.js";
import { addSetup, addReplacerSetup } from "../setup.sys.js";
import { log } from "../log.sys.js";

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
export const getRefreshToken = async function getRefreshToken(tokenStore){
	const key = getKey(tokenStore);
	const cached = temporaryCache.get(key);
	if (cached){
		return cached.value;
	}
	try {
		const credentials = await requestCredentials({
			openChoiceDialog: true,
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
	}
	catch (error){
		log("requestCredentials failed:", error);
	}
	return null;
};
export const setRefreshToken = async function setRefreshToken(tokenStore, refreshToken){
	if (refreshToken === await getRefreshToken(tokenStore)){
		return true;
	}
	setCache(getKey(tokenStore), refreshToken, 5000);
	const stored = await storeCredentials({
		login: tokenStore._username,
		password: refreshToken,
		host: tokenStore._loginOrigin,
	});
	return stored;
};
if (OAuth2Module.prototype.hasOwnProperty("getRefreshToken")){
	const originalGetRefreshToken = OAuth2Module.prototype.getRefreshToken;
	const alteredGetRefreshToken = async function(){
		const token = await getRefreshToken(this);log(token);
		if (token !== null){
			return token;
		}
		return originalGetRefreshToken.call(this);
	};
	addReplacerSetup(OAuth2Module.prototype, [
		{
			name: "getRefreshToken",
			replacement: alteredGetRefreshToken,
			defaultReturn: false,
		}
	]);
}
if (OAuth2Module.prototype.hasOwnProperty("setRefreshToken")){
	const originalSetRefreshToken = OAuth2Module.prototype.setRefreshToken;
	const alteredSetRefreshToken = async function(refreshToken){
		const stored = await setRefreshToken(this, refreshToken);
		if (!stored){
			return originalSetRefreshToken.call(this, refreshToken);
		}
		return refreshToken;
	};
	addReplacerSetup(OAuth2Module.prototype, [
		{
			name: "setRefreshToken",
			replacement: alteredSetRefreshToken,
			defaultReturn: false,
		}
	]);
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