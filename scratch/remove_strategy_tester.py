with open('src/WebContainer.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
for i, line in enumerate(lines):
    if 'mt-[48px] h-[calc(100vh-48px)] bg-[#131722] text-[#d1d4dc] overflow-y-auto' in line:
        start_idx = i
        break

if start_idx != -1:
    stack = 0
    end_idx = -1
    for i in range(start_idx, len(lines)):
        line = lines[i]
        stack += line.count('<div')
        stack -= line.count('</div')
        if stack == 0:
            end_idx = i
            break
            
    if end_idx != -1:
        print(f"Found Strategy Tester from {start_idx+1} to {end_idx+1}")
        del lines[start_idx:end_idx+1]
        with open('src/WebContainer.tsx', 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print("Deleted!")
    else:
        print("Could not find end tag")
else:
    print("Could not find start tag")
