import re

def get_closing_tag_index(lines, start_idx, tag_type="div"):
    stack = 0
    for i in range(start_idx, len(lines)):
        line = lines[i]
        
        # VERY basic html tag matching
        # Find all opening tags (excluding self-closing)
        open_tags = re.findall(f"<{tag_type}(?:>|\s+[^>]*>)", line)
        # Find all self-closing tags
        self_closing = re.findall(f"<{tag_type}[^>]*/>", line)
        # Find all closing tags
        close_tags = re.findall(f"</{tag_type}>", line)
        
        # Real opening tags = open_tags - self_closing
        num_open = len(open_tags) - len(self_closing)
        num_close = len(close_tags)
        
        stack += num_open
        stack -= num_close
        
        if stack <= 0:
            return i
    return -1

with open('src/WebContainer.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip_until = -1
deleted_ranges = []

for i in range(len(lines)):
    if i < skip_until:
        continue
    
    line = lines[i]
    
    # 1. Strategy Tester block: <div className="mt-[48px] h-[calc(100vh-48px)] bg-[#131722] text-[#d1d4dc] overflow-y-auto">
    if '<div className="mt-[48px] h-[calc(100vh-48px)] bg-[#131722] text-[#d1d4dc] overflow-y-auto">' in line:
        end = get_closing_tag_index(lines, i)
        if end != -1:
            deleted_ranges.append((i+1, end+1, "StrategyTester"))
            skip_until = end + 1
            continue

    # 2. Prediction Report Modal: {/* Advanced Prediction Report Modal */}
    # The actual modal might not be a div, it might be an aside or div. Let's just find the next <div or <aside
    if '{/* Advanced Prediction Report Modal */}' in line:
        div_start = -1
        tag_type = "div"
        for j in range(i, len(lines)):
            if '<div' in lines[j] or '<aside' in lines[j]:
                div_start = j
                tag_type = "aside" if "<aside" in lines[j] else "div"
                break
        if div_start != -1:
            end = get_closing_tag_index(lines, div_start, tag_type)
            if end != -1:
                deleted_ranges.append((i+1, end+1, "PredictionReportModal"))
                skip_until = end + 1
                continue

    # 3. Pine Editor block: {/* Pine Editor / Algo Panel */}
    if '{/* Pine Editor / Algo Panel */}' in line:
        div_start = -1
        tag_type = "div"
        for j in range(i, len(lines)):
            if '<div' in lines[j] or '<aside' in lines[j]:
                div_start = j
                tag_type = "aside" if "<aside" in lines[j] else "div"
                break
        if div_start != -1:
            end = get_closing_tag_index(lines, div_start, tag_type)
            if end != -1:
                deleted_ranges.append((i+1, end+1, "PineEditorPanel"))
                skip_until = end + 1
                continue

    new_lines.append(line)

print(f"Deleted ranges: {deleted_ranges}")
with open('src/WebContainer.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
