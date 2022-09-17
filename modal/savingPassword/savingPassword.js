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
	document.getElementById("yes").textContent = browser.i18n.getMessage("modal.savingPassword.yes");
	document.getElementById("no").textContent = browser.i18n.getMessage("modal.savingPassword.no");
	resizeToContent();
}
browser.runtime.onMessage.addListener(function(message){
	if (message.type === "start"){
		fillText(message);
		return new Promise(function(resolve){
			document.querySelectorAll("button").forEach(function(button){
				button.disabled = false;
				button.addEventListener("click", function(){
					if (button.id === "yes"){
						resolve(true);
					}
					else {
						resolve(false);
					}
					window.close();
				});
			});
		});
	}
	return false;
});

initModal();