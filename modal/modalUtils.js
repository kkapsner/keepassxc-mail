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
			if (replacements[key]){
				return replacements[key];
			}
		}
		return m;
	});
}

function initModal(){
	window.addEventListener("load", resizeToContent);
	window.addEventListener("keyup", function(event){
		if (event.key === "Escape"){
			window.close();
		}
	});
}