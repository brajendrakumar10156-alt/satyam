const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

const project = new Project();
const sourceFile = project.addSourceFileAtPath('src/WebContainer.tsx');

const webContainerFunc = sourceFile.getFunction('WebContainer');
if (!webContainerFunc) {
    console.error("WebContainer not found");
    process.exit(1);
}

const functionsToDelete = [
    'shiftCandles',
    'barsCount',
    'getSnappedPriceAndTime',
    'getAltInterval',
    'getOHLCDiff',
    'normalizeCandle',
    'toSeriesPoint',
    'requestDraw',
    'updateCrosshairDOM',
    'renderOHLCHeader',
    'formatIndValue',
    'renderIndValues',
    'renderChartOverlays',
    'getChartCoords',
    'findDrawingAtCoords',
    'distanceToSegment',
    'handlePointerDown',
    'handlePointerMove',
    'handlePointerUp',
    'handleNativeWheel',
    'AiChatPanel',
    'LeftSidePanel',
    'renderBountyPanel',
    'renderDiffViewer',
    'renderEditorPanel'
];

let deletedCount = 0;

// Remove variable statements (const handlePointerDown = ...)
const varStmts = webContainerFunc.getVariableStatements();
for (const stmt of varStmts) {
    const decls = stmt.getDeclarations();
    for (const decl of decls) {
        if (functionsToDelete.includes(decl.getName())) {
            console.log("Removing variable statement:", decl.getName());
            stmt.remove();
            deletedCount++;
            break;
        }
    }
}

// Remove normal functions (function handlePointerDown(...) { ... })
const innerFuncs = webContainerFunc.getFunctions();
for (const f of innerFuncs) {
    if (functionsToDelete.includes(f.getName())) {
        console.log("Removing function:", f.getName());
        f.remove();
        deletedCount++;
    }
}

console.log("Deleted count:", deletedCount);

if (deletedCount > 0) {
    sourceFile.saveSync();
    console.log("File saved!");
}
