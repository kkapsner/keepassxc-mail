const AssociatedAction = {
	NOT_ASSOCIATED: 0,
	ASSOCIATED: 1,
	NEW_ASSOCIATION: 2,
	CANCELED: 3
};

function tr(key, params) {
	"use strict";
	return browser.i18n.getMessage(key, params);
}
