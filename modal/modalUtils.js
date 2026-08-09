"use strict";

const windowLoad = new Promise(function(resolve){
	window.addEventListener("load", resolve);
});

async function resizeToContent(){
	await windowLoad;
	const sizingNode = document.querySelector("body");
	await browser.windows.update(browser.windows.WINDOW_ID_CURRENT, {
		width: sizingNode.clientWidth + 10 + window.outerWidth - window.innerWidth,
		height: sizingNode.clientHeight + 10 + window.outerHeight - window.innerHeight
	});
}

function parseText(text){
	const container = document.createDocumentFragment();
	
	let first = true;
	text.split(/\n/g).forEach(function(line){
		if (!first){
			container.appendChild(document.createElement("br"));
		}
		first = false;
		line.split(/\((http[^)]+)\)/g).forEach(function(linePart, index){
			if (index % 2 === 0){
				container.appendChild(document.createTextNode(linePart));
			}
			else {
				const a = document.createElement("a");
				a.target = "_blank";
				a.href = linePart;
				a.textContent = linePart;
				container.appendChild(a);
			}
		});
	});
	return container;
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