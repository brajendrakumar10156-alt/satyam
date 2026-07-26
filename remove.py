import re

with open('src/WebContainer.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

print('Before:', len(content.split('\n')))

content = re.sub(r"import \{ createChart \} from 'lightweight-charts';\n?", '', content)

start_idx = content.find("useEffect(() => {\n    if (!chartRef.current || renderEngine !== 'canvas2d') return;")
if start_idx != -1:
    depth = 0
    in_effect = False
    end_idx = -1
    for i in range(start_idx, len(content)):
        if content[i] == '{':
            depth += 1
            in_effect = True
        elif content[i] == '}':
            depth -= 1
            if in_effect and depth == 0:
                end_idx = content.find(');', i) + 2
                break
    if end_idx != -1:
        content = content[:start_idx] + content[end_idx:]
        print('Removed createChart useEffect')

start_idx = content.find("useEffect(() => {\n    if (!candleSeries.current || !allCandles.length) return;")
if start_idx != -1:
    depth = 0
    in_effect = False
    end_idx = -1
    for i in range(start_idx, len(content)):
        if content[i] == '{':
            depth += 1
            in_effect = True
        elif content[i] == '}':
            depth -= 1
            if in_effect and depth == 0:
                end_idx = content.find(');', i) + 2
                break
    if end_idx != -1:
        content = content[:start_idx] + content[end_idx:]
        print('Removed setData useEffect')

with open('src/WebContainer.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('After:', len(content.split('\n')))
