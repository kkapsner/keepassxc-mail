/* globals getMessage, resizeToContent, initModal */
"use strict";

function fillText(message){
	document.querySelector("title").textContent = getMessage("modal.savingPassword.title", message);
	document.querySelector(".question").textContent = getMessage(
		message.login && message.login !== true?
			"modal.savingPassword.questionWithLogin":
			"modal.savingPassword.questionWithoutLogin",
		message
	);
	document.querySelector(".doNotAskAgainText").textContent = browser.i18n.getMessage("modal.choice.doNotAskAgain");
	document.getElementById("createNewEntry").textContent = browser.i18n.getMessage("modal.savingPassword.newEntry");
	document.getElementById("yes").textContent = browser.i18n.getMessage("modal.savingPassword.yes");
	document.getElementById("no").textContent = browser.i18n.getMessage("modal.savingPassword.no");
	resizeToContent();
}
function fillSelect(message){
	if (!message.entries?.length){
		return;
	}
	const select = document.getElementById("entries");
	select.classList.remove("hidden");
	message.entries.forEach(function(entry){
		const option = new Option(getMessage("entryLabel", entry), entry.uuid);
		select.appendChild(option);
		option.selected = entry.preselected;
	});
}

initModal({messageCallback: function(message){
	fillText(message);
	fillSelect(message);
	return new Promise(function(resolve){
		document.querySelectorAll("button").forEach(function(button){
			button.disabled = false;
			button.addEventListener("click", function(){
				if (button.id === "yes"){
					resolve({
						save: true,
						uuid: document.getElementById("entries").value || null,
						doNotAskAgain: document.getElementById("doNotAskAgain").checked
					});
				}
				else {
					resolve({
						save: false,
						uuid: null,
						doNotAskAgain: document.getElementById("doNotAskAgain").checked
					});
				}
				window.close();
			});
		});
	});
}});