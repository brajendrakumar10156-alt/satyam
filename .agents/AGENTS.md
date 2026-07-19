# Project Rules

- ALL new features, code changes, and new files MUST be added to the `src_demo` folder first.
- The `src` folder is strictly considered the "production/original" code and must NOT be edited directly unless the user explicitly commands to port the code from `src_demo` to `src` after verifying it works perfectly.
- Keep the demo isolated. Test everything in `src_demo` first.
- **MANDATORY BACKUP RULE**: After EVERY significant code change or milestone (whether in `src_demo` or `src`), you MUST ask the user: "Should I take a Git backup now?". If they approve, you must run `git add . && git commit -m "<change description>" && git push`. Do NOT push without asking first. This rule applies to YOU and ANY subagent or agent working on this repository.
- **WEBGPU NATIVE ABSTRACTION RULE**: The WebGPU Engine (`WebGPUChartEngine.jsx`) MUST be built completely from scratch using the native `navigator.gpu` API and WGSL shaders. Do NOT use Pixi.js, Three.js, or any other Canvas/WebGL wrapper libraries for the WebGPU implementation. Any agent modifying the WebGPU mode must respect this native zero-dependency architecture.
