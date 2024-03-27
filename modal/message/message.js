/* globals getMessage, resizeToContent, initModal*/
"use strict";

function fillText(message){
	document.querySelector("title").textContent = message.title;
	const textNode = document.querySelector(".text");
	textNode.textContent = message.text;
	textNode.innerHTML = textNode.innerHTML.replace(/\n/g, "<br>");
	document.getElementById("ok").textContent = browser.i18n.getMessage("modal.message.ok");
}

initModal({messageCallback: function(message){
	return new Promise(function(resolve){
		fillText(message);
		document.querySelectorAll("button").forEach(function(button){
			button.disabled = false;
			button.addEventListener("click", function(){
				if (button.id === "ok"){
					resolve(true);
					window.close();
				}
			});
		});
		resizeToContent();
	});
}});