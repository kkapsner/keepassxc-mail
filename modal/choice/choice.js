"use strict";

function resizeToContent(){
	browser.runtime.sendMessage({
		action: "resize",
		width: document.querySelector(".content").clientWidth + 30,
		height: document.querySelector(".content").clientHeight + 30
	});
}

function getTranslation(name, variables){
	const translation = browser.i18n.getMessage(name) || name;
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

function fillText(message){
	document.querySelector("title").textContent = getTranslation("modal.choice.title", message);
	document.querySelector(".text").textContent = getTranslation(
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

function fillSelect(message){
	const select = document.getElementById("entries");
	message.entries.forEach(function(entry){
		select.appendChild(
			new Option(getTranslation("entryLabel", entry), entry.uuid)
		);
	});
}

browser.runtime.onMessage.addListener(function(message){
	if (message.type === "start"){
		fillText(message);
		fillSelect(message);
		return new Promise(function(resolve){
			document.querySelectorAll("button").forEach(function(button){
				button.disabled = false;
				button.addEventListener("click", function(){
					if (button.id === "ok"){
						resolve({
							selectedUuid: document.getElementById("entries").value,
							doNotAskAgain: document.getElementById("doNotAskAgain").checked
						});
					}
					else {
						resolve({selectedUuid: undefined, doNotAskAgain: false});
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