
const fs = require("fs");
const path = "./src/WebContainer.tsx";
let content = fs.readFileSync(path, "utf8");
content = content.replace(/ onCrosshairMove=\{handleCrosshairMove\}/g, "");
fs.writeFileSync(path, content, "utf8");
console.log("Removed handleCrosshairMove prop");

