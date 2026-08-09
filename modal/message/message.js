/* globals parseText, initModal, resizeToContent*/
"use strict";

function fillText(message){
	document.querySelector("title").textContent = message.title;
	const textNode = document.querySelector(".text");
	textNode.appendChild(parseText(message.text));
	document.getElementById("ok").textContent = browser.i18n.getMessage("modal.message.ok");
	if (message.id){
		document.querySelector("div.doNotNotifyAgain").style.display = "block";
		document.querySelector(".doNotNotifyAgainText").textContent = browser.i18n.getMessage(
			"modal.message.doNotNotifyAgain"
		);
	}
}

initModal({messageCallback: function(message){
	return new Promise(function(resolve){
		fillText(message);
		document.querySelectorAll("button").forEach(function(button){
			button.disabled = false;
			button.addEventListener("click", function(){
				if (button.id === "ok"){
					resolve({ok: true, doNotNotifyAgain: document.getElementById("doNotNotifyAgain").checked});
					window.close();
				}
			});
		});
		resizeToContent();
	});
}});