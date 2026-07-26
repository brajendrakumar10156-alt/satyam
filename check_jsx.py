import re

with open('src/WebContainer.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

return_idx = content.find('  return (\n')
if return_idx != -1:
    print('JSX size:', len(content[return_idx:].split('\n')))
else:
    print('Not found')
