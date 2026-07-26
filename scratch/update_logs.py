import datetime
import os

def main():
    time_str = datetime.datetime.now().strftime("%H:%M:%S IST")
    
    changelog_entry = f"""
### {time_str} — `src/WebContainer.tsx`
- **MODIFY:** Extracted `PineEditorPanel` logic into a separate component using ts-morph to safely handle AST transformation without breaking JSX fragment syntax. Original inline JSX replaced with a component render.
- **WHY:** To safely reduce file size and split logic without breaking React rendering limits or syntax.

### {time_str} — `src/components/layout/PineEditorPanel.tsx`
- **CREATE:** Created strictly typed PineScript Editor Panel using TypeScript.
- **WHY:** Adheres to user directive 'PINE EDITOR KO BEST LANGUAGE MAI LIKHO'.
"""
    
    with open('CHANGELOG.md', 'a', encoding='utf-8') as f:
        f.write(changelog_entry)
        
    resume_entry = f"""
## Session Log - {time_str}
- **Action:** Extracted `PineEditorPanel` from `WebContainer.tsx` using `ts-morph` AST parser.
- **Result:** Successfully split ~150 lines into `PineEditorPanel.tsx` with proper TypeScript typing without breaking the build (unlike string regex/substring attempts).
- **Next Steps:** Proceed with extracting `BottomPanel` using the same `ts-morph` strategy or tackle the user's question regarding `Canvas 2D, WebGPU, NPU, WASM` best languages.
"""
    
    with open('RESUME_CONTEXT.md', 'a', encoding='utf-8') as f:
        f.write(resume_entry)

if __name__ == '__main__':
    main()
