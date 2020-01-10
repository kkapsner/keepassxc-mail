const child_process = require("child_process");
const process = require("process");
const path = require("path");
const util = require("util");

function promisifyModule(module, functionNames, propertieNames){
	const promisifiedModule = {};
	functionNames.forEach(function(functionName){
		promisifiedModule[functionName] = util.promisify(module[functionName]);
	});
	propertieNames.forEach(function(propertyName){
		promisifiedModule[propertyName] = module[propertyName];
	});
	return promisifiedModule;
}

const fs = promisifyModule(require("fs"), ["access", "mkdir", "unlink"], ["constants"]);



async function run(){
	"use strict";
	
	const manifest = require("../manifest.json");
	const baseFolder = path.join(__dirname, "..");
	
	const outputFolder = path.join(baseFolder, "mail-ext-artifacts");
	try {
		await fs.access(outputFolder, fs.constants.F_OK);
	}
	catch (e){
		if (e.code === "ENOENT"){
			await fs.mkdir(outputFolder);
		}
		else {
			throw e;
		}
	}
	
	const fileName = `${manifest.name}-${manifest.version}.xpi`.replace(/\s+/g, "-");
	const filePath = path.join(outputFolder, fileName);
	try {
		await fs.unlink(filePath);
	}
	catch (e){}
	
	const exclude = ["mail-ext-artifacts/", "node_modules/*", ".*", "**/.*", "package*"];
	
	const args = ["-r", filePath, "./", "--exclude", ...exclude];
	
	process.chdir(baseFolder);
	
	child_process.spawn("zip", args, {stdio: "inherit"});
}

run();
