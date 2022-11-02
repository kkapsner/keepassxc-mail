"use strict";

const windowLoad = new Promise(function(resolve){
	window.addEventListener("load", resolve);
});

async function resizeToContent(){
	await windowLoad;
	const sizingNode = document.querySelector("body");
	await browser.runtime.sendMessage({
		action: "resize",
		width: sizingNode.clientWidth + 10 + window.outerWidth - window.innerWidth,
		height: sizingNode.clientHeight + 10 + window.outerHeight - window.innerHeight
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

function initModal({messageCallback}){
	const port = browser.runtime.connect();
	port.onMessage.addListener(async function(message){
		if (message.type === "start"){
			const value = await messageCallback(message.message);
			port.postMessage({
				type: "response",
				value
			});
		}
	});
	window.addEventListener("keyup", function(event){
		if (event.key === "Escape"){
			window.close();
		}
	});
}