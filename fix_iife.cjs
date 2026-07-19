const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'App.jsx');
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /<\/div>\s*\)\}\s*\{isMobile && mobileMenuOpen && \(/g,
  `</div>\n        );\n      })()}\n\n      {isMobile && mobileMenuOpen && (`
);

fs.writeFileSync(file, code);
console.log('App.jsx IIFE fixed');
