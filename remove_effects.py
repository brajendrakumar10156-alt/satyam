import re

with open('src/WebContainer.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
    
# Remove any useEffect block that has chartInstance.current or candleSeries.current
def remove_legacy_effects(text):
    pattern = re.compile(r'useEffect\(\(\) => \{')
    matches = [m.start() for m in pattern.finditer(text)]
    
    to_remove = []
    
    for start in matches:
        depth = 0
        in_effect = False
        end = -1
        for i in range(start, len(text)):
            if text[i] == '{':
                depth += 1
                in_effect = True
            elif text[i] == '}':
                depth -= 1
                if in_effect and depth == 0:
                    # Find the ending );
                    end = text.find(');', i)
                    if end != -1:
                        end += 2
                    else:
                        end = i + 1
                    break
                    
        if end != -1:
            block = text[start:end]
            if 'chartInstance.current' in block or 'candleSeries.current' in block or 'volumeSeries.current' in block:
                to_remove.append((start, end))
                
    # Remove from back to front
    for start, end in reversed(to_remove):
        text = text[:start] + text[end:]
        
    return text

new_content = remove_legacy_effects(content)

# Remove the actual refs
new_content = re.sub(r'const chartRef = useRef.*?\n', '', new_content)
new_content = re.sub(r'const chartInstance = useRef.*?\n', '', new_content)
new_content = re.sub(r'const candleSeries = useRef.*?\n', '', new_content)
new_content = re.sub(r'const volumeSeries = useRef.*?\n', '', new_content)
new_content = re.sub(r'const extraSeries = useRef.*?\n', '', new_content)
new_content = re.sub(r'const chartCreated =.*?\n', '', new_content)
new_content = re.sub(r'const \[chartCreated, setChartCreated\] = useState\(false\);\n', '', new_content)

with open('src/WebContainer.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
