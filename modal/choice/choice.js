/* globals getMessage, resizeToContent, initModal*/
"use strict";

function fillText(message){
	document.querySelector("title").textContent = getMessage("modal.choice.title", message);
	document.querySelector(".text").textContent = getMessage(
		message.login && message.login !== true?
			"modal.choice.textWithLogin":
			"modal.choice.textWithoutLogin",
		message
	);
	document.querySelector(".doNotAskAgainText").textContent = browser.i18n.getMessage("modal.choice.doNotAskAgain");
	document.getElementById("ok").textContent = browser.i18n.getMessage("modal.choice.ok");
	document.getElementById("cancel").textContent = browser.i18n.getMessage("modal.choice.cancel");
}

function fillSelect(message, sendAnswer){
	const select = document.getElementById("entries");
	message.entries.forEach(function(entry){
		const option = new Option(getMessage("entryLabel", entry), entry.uuid);
		option.entry = entry;
		select.appendChild(
			option
		);
	});
	select.addEventListener("change", function(){
		const selectedOption = select.options[select.selectedIndex];
		if (selectedOption?.entry?.autoSubmit){
			sendAnswer();
		}
	});
}

initModal({messageCallback: function(message){
	return new Promise(function(resolve){
		function sendAnswer(){
			resolve({
				selectedUuid: document.getElementById("entries").value,
				doNotAskAgain: document.getElementById("doNotAskAgain").checked
			});
			window.close();
		}
		fillText(message);
		fillSelect(message, sendAnswer);
		document.querySelectorAll("button").forEach(function(button){
			button.disabled = false;
			button.addEventListener("click", function(){
				if (button.id === "ok"){
					sendAnswer();
				}
				else {
					resolve({selectedUuid: undefined, doNotAskAgain: false});
					window.close();
				}
			});
		});
		resizeToContent();
	});
}});