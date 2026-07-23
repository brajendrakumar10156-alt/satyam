const fs = require('fs');
let appCode = fs.readFileSync('src_demo/App.tsx', 'utf8');

if (!appCode.includes("import { TopNavbar }")) {
    const importStr = "import { TopNavbar } from './components/layout/TopNavbar';\n";
    
    // Find last import statement
    const lines = appCode.split('\n');
    let lastImportIdx = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import ')) {
            lastImportIdx = i;
        }
    }
    
    lines.splice(lastImportIdx + 1, 0, importStr);
    fs.writeFileSync('src_demo/App.tsx', lines.join('\n'));
    console.log('Added TopNavbar import');
} else {
    console.log('TopNavbar import already exists');
}
