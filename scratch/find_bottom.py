import sys

def main():
    with open('src/WebContainer.tsx', 'r', encoding='utf-8') as f:
        lines = f.read().split('\n')
        
    bottom_start_str = 'className="absolute bottom-0 left-0 w-full h-3 z-50 cursor-pointer"'
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
        
    # we want to find where the <div ...> that starts at bottom_div_start closes
    # count opened <div> and closed </div>
    depth = 0
    bottom_end = -1
    for i in range(bottom_div_start, len(lines)):
        depth += lines[i].count('<div') - lines[i].count('</div')
        if depth == 0:
            bottom_end = i
            break
            
    print(f"BottomPanel: {bottom_div_start} to {bottom_end}")
    
    # Verify the contents!
    print("--- FIRST 5 LINES ---")
    for i in range(bottom_div_start, bottom_div_start + 5):
        print(lines[i])
        
    print("--- LAST 5 LINES ---")
    for i in range(bottom_end - 4, bottom_end + 1):
        print(lines[i])

if __name__ == '__main__':
    main()
