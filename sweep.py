import re

with open('src/WebContainer.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
depth = 0

for i, line in enumerate(lines):
    if skip:
        if '{' in line: depth += line.count('{')
        if '}' in line: depth -= line.count('}')
        if depth == 0 and '});' in line or ('}' in line and depth == 0):
            skip = False
        continue
    
    if "const chartRef = useRef(null);" in line: continue
    if "const chartInstance = useRef(null);" in line: continue
    if "const candleSeries = useRef(null);" in line: continue
    if "const volumeSeries = useRef(null);" in line: continue
    if "const extraSeries = useRef({});" in line: continue
    if "const chartContainerRef = useRef(null);" in line: continue # wait, chartContainerRef IS used for native events! Let's keep it.
    
    if "useEffect(() => {" in line and "candleSeries.current" in "".join(lines[i:i+3]):
        skip = True
        depth = line.count('{') - line.count('}')
        if depth == 0: skip = False
        continue

    # Same for updateIndicators effect
    if "useEffect(() => {" in line and "const updateIndicators = () => {" in "".join(lines[i:i+3]):
        skip = True
        depth = line.count('{') - line.count('}')
        if depth == 0: skip = False
        continue

    # Same for timeScale subscribeVisibleTimeRangeChange
    if "useEffect(() => {" in line and "chartInstance.current" in "".join(lines[i:i+3]) and "subscribeVisibleTimeRangeChange" in "".join(lines[i:i+20]):
        skip = True
        depth = line.count('{') - line.count('}')
        if depth == 0: skip = False
        continue
        
    new_lines.append(line)

with open('src/WebContainer.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
    
print('Done. Lines now:', len(new_lines))
