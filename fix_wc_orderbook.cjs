const fs = require('fs');
let content = fs.readFileSync('src/WebContainer.tsx', 'utf8');

content = content.replace(/import OrderBookPanel from '\.\/components\/OrderBookPanel';\n/, '');
content = content.replace(/OrderBookPanel=\{OrderBookPanel\} /g, '');

fs.writeFileSync('src/WebContainer.tsx', content, 'utf8');
