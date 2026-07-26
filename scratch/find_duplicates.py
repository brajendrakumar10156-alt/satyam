import collections

def analyze_duplicates(file_path, min_lines=5):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.read().split('\n')
        
    # We will look for duplicate blocks of size N
    # Using a simple sliding window and hash
    
    # Strip lines to ignore indentation differences
    stripped_lines = [l.strip() for l in lines]
    
    duplicates = collections.defaultdict(list)
    
    for block_size in range(20, min_lines-1, -2):  # Start large, go down
        for i in range(len(stripped_lines) - block_size + 1):
            block = tuple(stripped_lines[i:i+block_size])
            # Only consider blocks with some substantial content
            if sum(len(l) for l in block) < 50:
                continue
            # Ignore blocks that are mostly just brackets or empty lines
            if sum(1 for l in block if len(l) > 2) < block_size // 2:
                continue
                
            duplicates[block].append(i)
            
    # Filter out sub-blocks (if a larger block is already found)
    # This is a bit complex, let's just print the most frequent, largest blocks
    
    report = []
    seen_lines = set()
    
    for block, occurrences in sorted(duplicates.items(), key=lambda x: (len(x[0]), len(x[1])), reverse=True):
        if len(occurrences) < 2:
            continue
            
        # Check if this block is entirely within an already seen line range
        # to avoid printing overlapping sub-blocks
        if all(any(start <= occ < start+10 for start in seen_lines) for occ in occurrences):
            continue
            
        report.append(f"Found block of {len(block)} lines repeated {len(occurrences)} times:")
        report.append(f"Occurs at lines: {', '.join(str(o+1) for o in occurrences)}")
        report.append("Content preview:")
        report.append('\n'.join(block[:3]) + '\n...\n' + '\n'.join(block[-2:]))
        report.append("-" * 40)
        
        for occ in occurrences:
            for line_idx in range(occ, occ+len(block)):
                seen_lines.add(line_idx)
                
        if len(report) > 100:
            break
            
    with open('duplicate_report.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(report))
        
if __name__ == '__main__':
    analyze_duplicates('src/WebContainer.tsx', min_lines=6)
