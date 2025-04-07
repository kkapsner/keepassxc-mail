const child_process = require("child_process");
const process = require("process");
const path = require("path");

const fs = require("fs");

function leftPad(number, size){
	const str = number.toFixed(0);
	const missing = size - str.length;
	if (missing <= 0){
		return str;
	}
	return "0".repeat(missing) + str;
}

function updateVersion(version){
	const parts = version.split(".");
	if (parts.length < 2){
		parts[1] = "0";
	}
	const now = new Date();
	const date = `${now.getFullYear()}${leftPad(now.getMonth() + 1, 2)}${leftPad(now.getDate(), 2)}`;
	if (parts.length < 3 || parts[2] !== date){
		parts[2] = date;
		parts[3] = "0";
	}
	else {
		if (parts.length < 4){
			parts[3] = "0";
		}
		else {
			parts[3] = (parseInt(parts[3], 10) + 1).toFixed(0);
		}
	}
	return parts.join(".");
}

async function updateImports(filePath, version){
	console.log("Updating imports in", filePath);
	const content = await fs.promises.readFile(filePath, {encoding: "utf-8"});
	const modifiedContent = content.replace(
		/((?:^|[\n\r;])\s*import\s+[\s{}a-zA-Z0-9_,]+\s+from\s+"\.[a-zA-Z0-9/._-]+)\??[0-9.]*";/g,
		`$1?${version}";`
	);
	const originalContentPath = filePath + ".omjs";
	await fs.promises.rename(filePath, originalContentPath);
	await fs.promises.writeFile(filePath, modifiedContent, {encoding: "utf-8"});
	return {
		originalFilePath: filePath,
		originalContentPath
	};
}

async function updateAllImports(folder, version){
	return Promise.all(
		(await fs.promises.readdir(folder, {recursive: true, withFileTypes: true})).filter(function(fileInfo){
			return !fileInfo.isDirectory();
		}).map(async function(fileInfo){
			const filePath = path.join(fileInfo.parentPath, fileInfo.name);
			return await updateImports(filePath, version);
		})
	);
}

async function run(){
	"use strict";
	
	const baseFolder = path.join(__dirname, "..");
	
	const manifest = require("../manifest.json");
	console.log("updating version");
	manifest.version = updateVersion(manifest.version);
	console.log("... new:", manifest.version);
	console.log("updating manifest.json");
	await fs.promises.writeFile(
		path.join(baseFolder, "manifest.json"),
		JSON.stringify(manifest, undefined, "\t"),
		{encoding: "utf-8"}
	);
	const modifiedModules = await updateAllImports(path.join(baseFolder, "experiment", "modules"), manifest.version);
	
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
		"experiment/modules/*.omjs", "experiment/modules/**/*.omjs",
		"mail-ext-artifacts/", "mail-ext-artifacts/*",
		"versions/*",
		"crowdin.yml",
		"README.md",
		"node_modules/*", ".*", "**/.*", "package*", "src/"];
	
	const args = ["-r", filePath, "./", "--exclude", ...exclude];
	
	process.chdir(baseFolder);
	
	const zipProcess = child_process.spawn("zip", args, {stdio: "inherit"});
	
	zipProcess.on("exit", function(){
		modifiedModules.forEach(async function(module){
			console.log("restoring", module.originalFilePath);
			await fs.promises.rm(module.originalFilePath);
			await fs.promises.rename(module.originalContentPath, module.originalFilePath);
		});
	});
}

run();
