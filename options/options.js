"use strict";
const connectionColumns = [
	c => c.id,
	c => c.hash,
	c => c.key.substring(0, 8) + "*".repeat(5),
	c => new Date(c.lastUsed).toLocaleString(),
	c => new Date(c.created).toLocaleDateString(),
];
function createConnectionDisplay(connection){
	const container = document.createElement("tr");
	
	connectionColumns.forEach(function(column){
		const cell = document.createElement("td");
		cell.textContent = column(connection);
		cell.title = cell.textContent;
		container.appendChild(cell);
	});
	
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

function createPrivilegeInput(extension, privileges, privilegesApi, type){
	const input = document.createElement("input");
	input.type = "checkbox";
	const state = privileges[type];
	input.checked = state;
	input.indeterminate = state === undefined;
	input.addEventListener("change", function(){
		privilegesApi.setPrivileges(extension.id, type, input.checked);
	});
	return input;
}

function createPrivilegeResetButton(extension, privileges, privilegesApi, reset){
	const button = document.createElement("button");
	button.textContent = "🗑";
	button.addEventListener("click", async function(){
		await privilegesApi.setPrivileges(extension.id, "request", undefined);
		await privilegesApi.setPrivileges(extension.id, "store", undefined);
		await reset();
	});
	return button;
}

const privilegeColumns = [
	e => {
		const name = document.createElement("span");
		name.textContent = e.name;
		name.title = e.id;
		return name;
	},
	(e, p, api) => createPrivilegeInput(e, p, api, "request"),
	(e, p, api) => createPrivilegeInput(e, p, api, "store"),
	(e, p, api, reset) => createPrivilegeResetButton(e, p, api, reset),
];
async function createPrivilegesDisplay(extension, privilegesApi){
	const container = document.createElement("tr");
	async function reset(){
		const privileges = await privilegesApi.getPrivileges(extension.id);
		container.innerHTML = "";
		privilegeColumns
			.map(c => c(extension, privileges, privilegesApi, reset))
			.forEach(function(content){
				const cell = document.createElement("td");
				if (!(content instanceof Node)){
					cell.title = content;
					content = document.createTextNode(content);
				}
				cell.appendChild(content);
				container.appendChild(cell);
			});
	}
	reset();
	return container;
}

async function updatePrivileges(){
	const [privilegesApi, extensions, self] = await Promise.all([
		import("../modules/externalPrivileges.js"),
		browser.management.getAll(),
		browser.management.getSelf(),
	]);
	
	const privileges = document.getElementById("privileges");
	let onePresent = false;
	privileges.innerHTML = "";
	const rows = await Promise.all(
		extensions
			.filter(extension => extension.type === "extension" && extension.id !== self.id)
			.map(extension => createPrivilegesDisplay(extension, privilegesApi))
	);
	rows.forEach(row => {
		onePresent = true;
		privileges.appendChild(row);
	});
	if (!onePresent){
		document.getElementById("privilegesSection").style.display = "none";
	}
}
updatePrivileges();

const actions = {
	clearSelectedEntries: async function(){
		const backgroundPage = browser.extension.getBackgroundPage();
		backgroundPage.clearSelectedEntries();
	},
	reconnect: async function(){
		const backgroundPage = browser.extension.getBackgroundPage();
		const { connect, disconnect } = await backgroundPage.isKeepassReady();
		await disconnect();
		await connect(true);
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