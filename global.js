/* globals page */
"use strict";

const EXTENSION_NAME = "KeePassXC-Mail";

const AssociatedAction = {
	NOT_ASSOCIATED: 0,
	ASSOCIATED: 1,
	NEW_ASSOCIATION: 2,
	CANCELED: 3
};

function tr(key, params) {
	return browser.i18n.getMessage(key, params);
}

// Returns file name and line number from error stack
const getFileAndLine = function() {
	const err = new Error().stack.split("\n");
	const line = err[4] ?? err[err.length - 1];
	const result = line.substring(line.lastIndexOf("/") + 1, line.lastIndexOf(":"));
	
	return result;
};

const debugLogMessage = function(message, extra) {
	console.log(`[Debug ${getFileAndLine()}] ${EXTENSION_NAME} - ${message}`);

	if (extra) {
		console.log(extra);
	}
};

const logDebug = function(message, extra) {
	if (page.settings.debugLogging) {
		debugLogMessage(message, extra);
	}
};

const logError = function(message) {
	console.log(`[Error ${getFileAndLine()}] ${EXTENSION_NAME} - ${message}`);
};