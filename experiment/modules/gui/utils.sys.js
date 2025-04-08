import { extension } from "../extension.sys.js";
import { requestCredentials } from "../credentials.sys.js";

function getTranslation(name, variables){
	const translation = extension.localeData.localizeMessage(name) || name;
	if (!variables){
		return translation;
	}
	return translation.replace(/\{\s*([^}]*?)\s*\}/g, function(m, name){
		const namesToTry = name.split(/\s*\|\s*/g);
		for (const name of namesToTry){
			if (name.match(/^["'].*["']$/)){
				return name.replace(/^['"]|['"]$/g, "");
			}
			if (variables[name]){
				return variables[name];
			}
		}
		return m;
	});
}

export function buildDialogGui(guiOperations, credentialInfo){
	const xulNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
	const window = guiOperations.window;
	const document = window.document;
	
	/* add ui elements to dialog */
	const row = document.createElementNS(xulNS, "row");
	row.setAttribute("id", "credentials-row");
	
	// spacer to take up first column in layout
	const spacer = document.createElementNS(xulNS, "spacer");
	spacer.setAttribute("flex", "1");
	row.appendChild(spacer);
	
	// this box displays labels and also the list of entries when fetched
	const box = document.createElementNS(xulNS, "hbox");
	box.setAttribute("id", "credentials-box");
	box.setAttribute("align", "center");
	box.setAttribute("flex", "1");
	box.setAttribute("pack", "start");
	
	const description = document.createElementNS(xulNS, "description");
	description.setAttribute("id", "credentials-description");
	description.setAttribute("align", "start");
	description.setAttribute("flex", "1");
	description.setAttribute("value", getTranslation("loadingPasswords"));
	description.setAttribute("tooltiptext", getTranslation("credentialInfo", credentialInfo));
	box.appendChild(description);
	
	const retryButton = document.createElementNS(xulNS, "button");
	retryButton.setAttribute("label", getTranslation("retry"));
	retryButton.addEventListener("command", async function(){
		retryButton.style.display = "none";
		description.setAttribute("value", getTranslation("loadingPasswords"));
		const credentialDetails = await requestCredentials(credentialInfo);
		updateGUI(guiOperations, credentialInfo, credentialDetails);
		window.sizeToContent();
	});
	retryButton.setAttribute("id", "credentials-retry-button");
	retryButton.style.display = "none";
	box.appendChild(retryButton);
	row.appendChild(box);
	
	guiOperations.guiParent.appendChild(row);
	
	// hide "save password" checkbox
	const checkbox = document.getElementById("checkbox");
	if (checkbox?.checked){
		checkbox.click();
	}
	const checkboxContainer = document.getElementById("checkboxContainer");
	if (checkboxContainer){
		checkboxContainer.hidden = true;
	}
	
	window.sizeToContent();
}

export function updateGUI(guiOperations, credentialInfo, credentialDetails){
	const xulNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
	const window = guiOperations.window;
	const document = window.document;
	const row = document.getElementById("credentials-row");
	const box = document.getElementById("credentials-box");
	const description = document.getElementById("credentials-description");
	if (!(row && box && description)){
		return;
	}
	
	function fillCredentials(credentials){
		description.value = getTranslation("pickedEntry", credentials);
		guiOperations.fillCredentials(credentialInfo, credentials);
	}
	const credentials = credentialDetails.credentials;
	if (!credentials.length){
		description.setAttribute("value", getTranslation("noPasswordsFound"));
		document.getElementById("credentials-retry-button").style.display = "";
		window.sizeToContent();
		return;
	}
	
	fillCredentials(credentials[0]);
	if (credentials.length === 1){
		if (credentialDetails.autoSubmit && !credentials[0].skipAutoSubmit){
			guiOperations.submit();
		}
		return;
	}

	const list = document.createElementNS(xulNS, "menulist");
	list.setAttribute("id", "credentials-list");
	const popup = document.createElementNS(xulNS, "menupopup");

	credentials.forEach(function(credentials){
		const item = document.createElementNS(xulNS, "menuitem");
		item.setAttribute("label", getTranslation("entryLabel", credentials));
		item.setAttribute("tooltiptext", getTranslation("entryTooltip", credentials));
		item.addEventListener("command", function(){
			fillCredentials(credentials);
			if (credentialDetails.autoSubmit && !credentials.skipAutoSubmit){
				guiOperations.submit();
			}
		});
		popup.appendChild(item);
	});

	list.appendChild(popup);
	box.appendChild(list);
	
	window.sizeToContent();
}