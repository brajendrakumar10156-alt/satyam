const fs = require('fs');
const appContent = fs.readFileSync('src_demo/App.tsx', 'utf8');
const lines = appContent.split('\n');
for (let i = 0; i < 400; i++) {
    if (lines[i].includes('rightSidebar')) {
        console.log(Line : );
    }
}
