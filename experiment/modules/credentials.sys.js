import { passwordEmitter, passwordRequestEmitter } from "./emitters.sys.js";

export async function storeCredentials(data){
	const eventData = await passwordEmitter.emit(
		"password", data
	);
	return eventData.reduce(function(alreadyStored, stored){
		return alreadyStored || stored;
	}, false);
}

export async function requestCredentials(credentialInfo){
	const eventData = await passwordRequestEmitter.emit(
		"password-requested", credentialInfo
	);
	return eventData.reduce(function(details, currentDetails){
		if (!currentDetails){
			return details;
		}
		details.autoSubmit &= currentDetails.autoSubmit;
		if (currentDetails.credentials && currentDetails.credentials.length){
			details.credentials = details.credentials.concat(currentDetails.credentials);
		}
		return details;
	}, {autoSubmit: true, credentials: []});
}