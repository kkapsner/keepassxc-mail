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
	Object.keys(keyRing).forEach(function(hash){
		connections.appendChild(createConnectionDisplay(keyRing[hash]));
	});
}
updateConnections();

const actions = {
	reconnect: function(){
		browser.extension.getBackgroundPage().keepass.reconnect();
	},
	associate: function(){
		browser.extension.getBackgroundPage().keepass.associate();
		updateConnections();
	}
};
document.querySelectorAll(".action").forEach(async function(button){
	button.addEventListener("click", actions[button.id]);
});
document.querySelectorAll("input.setting").forEach(async function(input){
	const settingName = input.id;
	const currentValue = await browser.storage.local.get([settingName]);
	switch (typeof currentValue[settingName]){
		case "undefined":
			currentValue[settingName] = JSON.parse(input.dataset.defaultValue);
			break;
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