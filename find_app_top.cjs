const fs = require('fs');
const file = 'src_demo/App.tsx';
let code = fs.readFileSync(file, 'utf8');

const lines = code.split('\n');
let appStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('export default function App')) {
    appStart = i;
    break;
  }
}

let returnStart = -1;
if (appStart !== -1) {
  for (let i = appStart; i < lines.length; i++) {
    if (lines[i].trim() === 'return (') {
      returnStart = i;
      break;
    }
  }
}

if (returnStart !== -1) {
  const block = lines.slice(returnStart, returnStart + 400).join('\n');
  fs.writeFileSync('app_ui_top.txt', block);
  console.log('App UI top block written to app_ui_top.txt');
} else {
  console.log('Not found');
}
