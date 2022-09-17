"use strict";
function createConnectionDisplay(connection){
	const container = document.createElement("div");
	
	const lastUsedDate = new Date(connection.lastUsed);
	const createDate = new Date(connection.created);
	
	container.textContent =
		`${connection.id}: ${connection.hash} (${lastUsedDate.toLocaleString()} - ${createDate.toLocaleDateString()})`;
	
	return container;
}
async function updateConnections(){
	const keyRing = (await browser.storage.local.get({"keyRing": {}})).keyRing;
	
	const connections = document.getElementById("connections");
	connections.innerHTML = "";
	Object.keys(keyRing).forEach(function(hash){
		connections.appendChild(createConnectionDisplay(keyRing[hash]));
	});
}
updateConnections();

const actions = {
	clearSelectedEntries: async function(){
		const backgroundPage = browser.extension.getBackgroundPage();
		backgroundPage.clearSelectedEntries();
	},
	reconnect: async function(){
		const backgroundPage = browser.extension.getBackgroundPage();
		await backgroundPage.disconnect();
		await backgroundPage.connect(true);
		await backgroundPage.keepass.associate();
		await updateConnections();
	},
	associate: async function(){
		await browser.extension.getBackgroundPage().keepass.associate();
		await updateConnections();
	}
};

async function wait(ms){
	return new Promise(function(resolve){
		window.setTimeout(function(){
			resolve();
		}, ms);
	});
}

document.querySelectorAll(".action").forEach(async function(button){
	const activeMessageId = button.dataset.activeMessage;
	const activeMessage = activeMessageId? browser.i18n.getMessage(activeMessageId): false;
	let active = false;
	button.addEventListener("click", async function(){
		if (active){
			return;
		}
		const oldContent = button.textContent;
		button.disabled = true;
		active = true;
		const promises = [actions[button.id]()];
		if (activeMessage){
			button.textContent = activeMessage;
			promises.push(wait(500));
		}
		await Promise.all(promises);
		button.textContent = oldContent;
		active = false;
		button.disabled = false;
	});
});
document.querySelectorAll("input.setting").forEach(async function(input){
	const settingName = input.id;
	const currentValue = await browser.storage.local.get([settingName]);
	let type = typeof currentValue[settingName];
	if (type === "undefined"){
		currentValue[settingName] = JSON.parse(input.dataset.defaultValue);
		type = typeof currentValue[settingName];
	}
	switch (type){
		case "boolean":
			input.checked = currentValue[settingName];
			break;
		default:
			input.value = currentValue[settingName];
	}
	input.addEventListener("change", function(){
		let newValue = input.value;
		switch (typeof currentValue[settingName]){
			case "boolean":
				newValue = input.checked;
				break;
			case "number":
				newValue = parseFloat(input.value);
				break;
		}
		browser.storage.local.set({
			[settingName]: newValue
		});
	});
});

document.querySelectorAll("*[data-translation]").forEach(function(node){
	node.textContent = browser.i18n.getMessage(node.dataset.translation);
});