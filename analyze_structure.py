import re

with open('src/WebContainer.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

blocks = []
current_block = None
brace_count = 0

for i, line in enumerate(lines):
    line_num = i + 1
    
    if current_block is None:
        match = re.match(r'^\s*(const \w+|function \w+|use\w+\(|useEffect\()', line)
        if match:
            current_block = {
                'name': match.group(1),
                'start': line_num,
                'end': line_num
            }
            brace_count = line.count('{') - line.count('}')
            if brace_count == 0 and '{' not in line and '(' in line and not line.strip().endswith(')'):
                brace_count = 1
            if brace_count <= 0 and '{' in line:
                current_block['end'] = line_num
                blocks.append(current_block)
                current_block = None
    else:
        brace_count += line.count('{') - line.count('}')
        if brace_count <= 0:
            current_block['end'] = line_num
            blocks.append(current_block)
            current_block = None

blocks.sort(key=lambda x: x['end'] - x['start'], reverse=True)

print("Top 20 largest code blocks in WebContainer.tsx:")
for b in blocks[:20]:
    print(f"{b['name']} ({b['start']} to {b['end']}): {b['end'] - b['start']} lines")
