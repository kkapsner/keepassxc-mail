import { extension } from "./extension.sys.js";
export const log = console.log.bind(console, `KeePassXC-Mail (${extension.addonData.version}):`);