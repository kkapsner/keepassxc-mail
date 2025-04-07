import { extension } from "./extension.sys.mjs";
export const log = console.log.bind(console, `KeePassXC-Mail (${extension.addonData.version}):`);