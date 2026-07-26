import sys

def main():
    with open('src/WebContainer.tsx', 'r', encoding='utf-8') as f:
        lines = f.read().split('\n')
        
    bottom_start_str = 'className={`w-full ${t.bg} flex flex-col min-h-0 transition-all'
    bottom_div_start = -1
    for i in range(len(lines)):
        if bottom_start_str in lines[i]:
            for j in range(i, -1, -1):
                if '<div' in lines[j]:
                    bottom_div_start = j
                    break
            break
            
    if bottom_div_start == -1:
        print("BottomPanel start not found")
        return
        
    depth = 0
    bottom_end = -1
    for i in range(bottom_div_start, len(lines)):
        depth += lines[i].count('<div') - lines[i].count('</div')
        if depth == 0:
            bottom_end = i
            break
            
    print(f"BottomPanel Main Div: {bottom_div_start} to {bottom_end}")
    
    # Also find where the self closing `<div className="absolute bottom-0 left-0 w-full h-3 z-50 cursor-pointer"` is
    hover_div_start = -1
    for i in range(len(lines)):
        if 'className="absolute bottom-0 left-0 w-full h-3 z-50 cursor-pointer"' in lines[i]:
            for j in range(i, -1, -1):
                if '{lowerBoxState' in lines[j]:
                    hover_div_start = j
                    break
            break
            
    print(f"Hover Trigger: {hover_div_start} to {bottom_div_start-1}")

if __name__ == '__main__':
    main()
