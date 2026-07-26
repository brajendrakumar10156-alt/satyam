const fs = require('fs');
const content = fs.readFileSync('src/WebContainer.tsx', 'utf8');
const lines = content.split('\n');

const components = [];
let currentFunc = null;
let currentStart = 0;
let depth = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/const (render[A-Za-z0-9_]+|export function [A-Za-z0-9_]+|[A-Za-z0-9_]+) =/);
    
    if (match && depth === 0) {
        currentFunc = match[1];
        currentStart = i;
    }
    
    if (line.includes('{')) depth += (line.match(/\{/g) || []).length;
    if (line.includes('}')) depth -= (line.match(/\}/g) || []).length;
    
    if (depth === 0 && currentFunc) {
        components.push({ name: currentFunc, lines: i - currentStart });
        currentFunc = null;
    }
}

components.sort((a, b) => b.lines - a.lines);
console.log(components.slice(0, 20).map(c => ${c.name}:  lines).join('\n'));
