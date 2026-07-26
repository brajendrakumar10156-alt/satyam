import re

file_path = 'src/WebContainer.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

def find_usages(pattern):
    matches = re.finditer(pattern, content)
    results = []
    for m in matches:
        line_num = content.count('\n', 0, m.start()) + 1
        results.append(line_num)
    return results

print("=== Component Usages ===")
components = ['<TopNavbar', '<LeftToolbar', '<RightSidebar', '<BottomPanel', '<PineEditorPanel']
for comp in components:
    lines = find_usages(comp)
    print(f"{comp}: {lines}")

print("\n=== render* Functions ===")
funcs = re.findall(r'const render[A-Za-z0-9_]+\s*=', content)
print(funcs)
