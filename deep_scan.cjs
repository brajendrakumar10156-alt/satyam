
const fs = require("fs");
const path = require("path");

function getFiles(dir, filesList = []) {
    if(!fs.existsSync(dir)) return filesList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            getFiles(fullPath, filesList);
        } else {
            if (fullPath.endsWith(".tsx") || fullPath.endsWith(".ts")) {
                filesList.push(fullPath);
            }
        }
    }
    return filesList;
}

const components = getFiles("./src/components").map(f => path.basename(f, ".tsx").replace(".ts", ""));
const webContainerContent = fs.readFileSync("./src/WebContainer.tsx", "utf8");

const report = {
    imported: [],
    notImported: [],
};

for (const comp of components) {
    const regex = new RegExp("import.*" + comp + ".*from", "i");
    const isUsed = new RegExp("<" + comp + "[\\\\s>]", "i");
    
    if (regex.test(webContainerContent) || isUsed.test(webContainerContent)) {
        report.imported.push(comp);
    } else {
        report.notImported.push(comp);
    }
}

console.log("DEEP SCAN RESULTS FOR WebContainer.tsx:");
console.log("======================================");
console.log("Total components found in src/components: " + components.length);
console.log("");
console.log("IMPORTED & CONNECTED:");
console.log(report.imported.length > 0 ? report.imported.join(", ") : "None");
console.log("");
console.log("NOT IMPORTED (Detached / Duplicated Code):");
console.log(report.notImported.length > 0 ? report.notImported.join("\n- ") : "None");


