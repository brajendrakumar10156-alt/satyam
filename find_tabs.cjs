const fs = require('fs');
const lines = fs.readFileSync('src_demo/App.tsx', 'utf8').split('\n');
const toFind = ['setRightSidebar', 'setTradingTab'];
for(let i=0; i<800; i++) {
  if (lines[i] && toFind.some(t => lines[i].includes(t))) {
    console.log(Line : );
  }
}

