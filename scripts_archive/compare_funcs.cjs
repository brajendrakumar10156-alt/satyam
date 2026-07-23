const fs = require('fs');
const path = require('path');

function extractFunctions(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const functions = new Set();
  
  const regexes = [
    /const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g,
    /function\s+([a-zA-Z0-9_]+)\s*\(/g,
    /const\s+([a-zA-Z0-9_]+)\s*=\s*useCallback\(/g,
    /const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?[a-zA-Z0-9_]+\s*=>/g
  ];

  lines.forEach(line => {
    regexes.forEach(regex => {
      let match;
      // We must reset lastIndex if we reuse regexes globally, 
      // but creating new ones or string.matchAll is safer
    });
  });

  // Let's use matchAll
  for (const regex of regexes) {
    const matches = content.matchAll(regex);
    for (const match of matches) {
      functions.add(match[1]);
    }
  }
  return functions;
}

const srcApp = path.join(__dirname, 'src', 'App.jsx');
const srcDemoApp = path.join(__dirname, 'src_demo', 'App.jsx');

const srcFns = extractFunctions(srcApp);
const demoFns = extractFunctions(srcDemoApp);

const missingInDemo = [...srcFns].filter(f => !demoFns.has(f));
const extraInDemo = [...demoFns].filter(f => !srcFns.has(f));

console.log("Functions in src/App.jsx but MISSING in src_demo/App.jsx:");
console.log(missingInDemo);

console.log("\nFunctions in src_demo/App.jsx but NOT in src/App.jsx:");
console.log(extraInDemo);

