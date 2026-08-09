/* globals parseText, initModal, resizeToContent*/
"use strict";

function fillText(message){
	document.querySelector("title").textContent = message.title;
	const textNode = document.querySelector(".question");
	textNode.appendChild(parseText(message.question));
	document.getElementById("yes").textContent = browser.i18n.getMessage("modal.confirm.yes");
	document.getElementById("no").textContent = browser.i18n.getMessage("modal.confirm.no");
}

initModal({messageCallback: function(message){
	return new Promise(function(resolve){
		fillText(message);
		document.querySelectorAll("button").forEach(function(button){
			button.disabled = false;
			button.addEventListener("click", function(){
				if (button.id === "yes"){
					resolve(true);
					window.close();
				}
				else if (button.id === "no"){
					resolve(false);
					window.close();
				}
			});
		});
		resizeToContent();
	});
}});