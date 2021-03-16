"use strict";

function resizeToContent(){
	browser.runtime.sendMessage({
		action: "resize",
		width: document.querySelector(".content").clientWidth + 30,
		height: document.querySelector(".content").clientHeight + 30
	});
}
function fillText(message){
	function replace(string){
		return string
			.replace("{host}", message.host)
			.replace("{login}", message.login);
	}
	function replaceMessage(id){
		return replace(browser.i18n.getMessage(id));
	}
	
	document.querySelector("title").textContent = replaceMessage("modal.savingPassword.title");
	document.querySelector(".question").textContent = replaceMessage(
		message.login === true?
			"modal.savingPassword.questionWithoutLogin":
			"modal.savingPassword.questionWithLogin"
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

window.addEventListener("load", resizeToContent);
window.addEventListener("keyup", function(event){
	if (event.key === "Escape"){
		window.close();
	}
});