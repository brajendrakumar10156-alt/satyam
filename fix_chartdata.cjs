
const fs = require("fs");
const path = "./src/WebContainer.tsx";
let content = fs.readFileSync(path, "utf8");
content = content.replace(/candles=\{chartData\}/g, "candles={allCandles}");
fs.writeFileSync(path, content, "utf8");
console.log("Fixed chartData to allCandles");

