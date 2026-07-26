def run():
    with open('src/WebContainer.tsx', 'r', encoding='utf-8') as f:
        lines = f.read().split('\n')
        
    start_line = -1
    end_line = -1
    
    for i, line in enumerate(lines):
        if '{/* Positions & Orders Main Area */}' in line:
            start_line = i
        if start_line != -1 and "{/* Unified Split Right Sidebar Container */}" in line:
            end_line = i - 1
            break
            
    print(f"Start: {start_line}, End: {end_line}")
    if start_line != -1 and end_line != -1:
        print("Lines to replace:")
        print(lines[start_line])
        print("...")
        print(lines[end_line])

if __name__ == '__main__':
    run()
