const fs = require('fs');
const lines = fs.readFileSync('src_demo/App.tsx', 'utf8').split('\n');
for(let i=150; i<500; i++) {
  if (lines[i] && lines[i].includes('tradingTab')) {
    console.log(Line : );
  }
}

