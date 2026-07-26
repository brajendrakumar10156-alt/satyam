with open('scratch/return_block.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

def get_block_size(start_line):
    stack = 0
    for i in range(start_line, len(lines)):
        line = lines[i]
        stack += line.count('{')
        stack -= line.count('}')
        stack += line.count('<')  # simplistic tag matching
        stack -= line.count('>')
        
        # very crude bracket matcher
        pass
    return 0
