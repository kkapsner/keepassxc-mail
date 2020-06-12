const child_process = require("child_process");
const process = require("process");
const path = require("path");
const util = require("util");

const fs = require("fs");

async function run(){
	"use strict";
	
	const manifest = require("../manifest.json");
	const baseFolder = path.join(__dirname, "..");
	
	const outputFolder = path.join(baseFolder, "mail-ext-artifacts");
	try {
		await fs.promises.access(outputFolder, fs.constants.F_OK);
	}
	catch (e){
		if (e.code === "ENOENT"){
			await fs.promises.mkdir(outputFolder);
		}
		else {
			throw e;
		}
	}
	
	const fileName = `${manifest.name}-${manifest.version}.xpi`.replace(/\s+/g, "-");
	const filePath = path.join(outputFolder, fileName);
	try {
		await fs.promises.unlink(filePath);
	}
	catch (e){}
	
	const exclude = [
		"mail-ext-artifacts/", "mail-ext-artifacts/*",
		"versions/*",
		"node_modules/*", ".*", "**/.*", "package*", "src/"];
	
	const args = ["-r", filePath, "./", "--exclude", ...exclude];
	
	process.chdir(baseFolder);
	
	child_process.spawn("zip", args, {stdio: "inherit"});
}

run();
