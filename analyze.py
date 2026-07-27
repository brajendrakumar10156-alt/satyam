import re

with open('src/WebContainer.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

blocks = []
current_block = None
start_line = 0

for i, line in enumerate(lines):
    if line.strip().startswith('const ') and (' = (' in line or ' = ' in line) and '=>' in line:
        if current_block:
            blocks.append((current_block, start_line, i))
        current_block = line.strip().split(' ')[1]
        start_line = i
    elif line.strip().startswith('function ') or line.strip().startswith('export default function '):
        if current_block:
            blocks.append((current_block, start_line, i))
        match = re.search(r'function (\w+)', line)
        if match:
            current_block = match.group(1)
        else:
            current_block = "Unknown"
        start_line = i

if current_block:
    blocks.append((current_block, start_line, len(lines)))

for name, start, end in sorted(blocks, key=lambda x: x[2] - x[1], reverse=True)[:30]:
    print(f"{name}: {end - start} lines (from {start} to {end})")
