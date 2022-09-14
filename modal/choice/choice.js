"use strict";

function resizeToContent(){
	browser.runtime.sendMessage({
		action: "resize",
		width: document.querySelector(".content").clientWidth + 30,
		height: document.querySelector(".content").clientHeight + 30
	});
}

function getMessage(name, replacements){
	const message = browser.i18n.getMessage(name) || name;
	if (!replacements){
		return message;
	}
	return message.replace(/\{\s*([^}]*?)\s*\}/g, function(m, key){
		const keysToTry = key.split(/\s*\|\s*/g);
		for (const key of keysToTry){
			if (key.match(/^["'].*["']$/)){
				return key.replace(/^['"]|['"]$/g, "");
			}
			if (replacements.hasOwnProperty("name")){
				return replacements[key];
			}
		}
		return m;
	});
}

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
	resizeToContent();
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

browser.runtime.onMessage.addListener(function(message){
	if (message.type === "start"){
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