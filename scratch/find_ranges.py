import sys

def main():
    with open('src/WebContainer.tsx', 'r', encoding='utf-8') as f:
        lines = f.read().split('\n')
        
    start_idx = -1
    for i, line in enumerate(lines):
        if "const renderEditorPanel =" in line:
            start_idx = i
            break
            
    if start_idx == -1:
        print("PineEditorStart not found")
        return
        
    depth = 0
    end_idx = -1
    for i in range(start_idx, len(lines)):
        for char in lines[i]:
            if char == '(':
                depth += 1
            elif char == ')':
                depth -= 1
        if depth == 0 and lines[i].strip() == ');':
            end_idx = i
            break
            
    print(f"PineEditor: {start_idx} to {end_idx}")
    
    # BottomPanel
    bottom_start_str = 'className="absolute bottom-0 left-0 w-full h-3 z-50 cursor-pointer"'
    bottom_div_start = -1
    for i in range(len(lines)):
        if bottom_start_str in lines[i]:
            # go back to find <div
            for j in range(i, -1, -1):
                if '<div' in lines[j]:
                    bottom_div_start = j
                    break
            break
            
    if bottom_div_start == -1:
        print("BottomPanel start not found")
        return
        
    bottom_end = -1
    for i in range(bottom_div_start, len(lines)):
        if '{/* Floating Modals */}' in lines[i]:
            bottom_end = i - 1
            break
            
    print(f"BottomPanel: {bottom_div_start} to {bottom_end}")

if __name__ == '__main__':
    main()
