const fs = require('fs');
const appContent = fs.readFileSync('src_demo/App.tsx', 'utf8');
const lines = appContent.split('\n');
const states = [];
let capture = false;
for (let i = 0; i < 500; i++) {
    if (lines[i] && lines[i].includes('export default function App()')) {
        capture = true;
    }
    if (capture && lines[i] && lines[i].includes('useState(')) {
        states.push(lines[i].trim());
    }
}
console.log(states.join('\n'));
