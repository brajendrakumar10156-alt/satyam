import re

with open('src/WebContainer.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

components = []
current_func = None
current_start = 0
depth = 0

for i, line in enumerate(lines):
    match = re.search(r'const (render[A-Za-z0-9_]+|export function [A-Za-z0-9_]+|[A-Za-z0-9_]+) =', line)
    
    if match and depth == 0:
        current_func = match.group(1)
        current_start = i
        
    depth += line.count('{') - line.count('}')
    
    if depth == 0 and current_func:
        components.append((current_func, i - current_start))
        current_func = None

components.sort(key=lambda x: x[1], reverse=True)
for c in components[:20]:
    print(f"{c[0]}: {c[1]} lines")
