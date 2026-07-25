# Project Rules

- Code changes, features, and new files can be added directly to the active workspace folders (`src`, `backend_rust`, etc.) as commanded by the user.
- **MANDATORY BACKUP RULE**: After EVERY significant code change or milestone (whether in `src_demo` or `src`), you MUST ask the user: "Should I take a Git backup now?". If they approve, you must run `git add . && git commit -m "<change description>" && git push`. Do NOT push without asking first. This rule applies to YOU and ANY subagent or agent working on this repository.
- **WEBGPU NATIVE ABSTRACTION RULE**: The WebGPU Engine (`WebGPUChartEngine.jsx`) MUST be built completely from scratch using the native `navigator.gpu` API and WGSL shaders. Do NOT use Pixi.js, Three.js, or any other Canvas/WebGL wrapper libraries for the WebGPU implementation. Any agent modifying the WebGPU mode must respect this native zero-dependency architecture.
- **MANDATORY CHANGELOG RULE**: After EVERY code change (modify, create, delete), you MUST append an entry to `CHANGELOG.md` in the project root. Each entry MUST include: (1) Date and Time with HH:MM:SS IST, (2) File path that was changed, (3) Action type (MODIFY/CREATE/DELETE/OVERWRITE), (4) What the OLD value was, (5) What the NEW value is, (6) WHY the change was made. Format: `### HH:MM:SS IST — \`file/path\``. This rule applies to YOU and ANY subagent. Do NOT skip this for any change, no matter how small. The user should NEVER have to ask for this — it must happen automatically.
- **MANDATORY ARCHITECTURE RULE**: Any AI or Human working on server setup, backend pipelines, proxies, or storage MUST refer to `server_roadmap.md` located in the workspace root. Do NOT add new servers or engines without consulting the Omni-Engine blueprint mapped in that file.

## The Core Philosophy (No Jugaad)
- **Pure Native Only:** Kisi bhi saste wrapper (jaise PixiJS, Three.js) ya transpiler ka use nahi hoga. Har hardware component apni Native Language me likha jayega.
- **Math First:** Math calculation hamesha priority par rahegi. Agar hardware struggle karega, toh rendering quality giregi par calculation speed nahi.

## The Multi-Engine Breakdown
**3 Math Engines:**
- **Rust (WASM):** For precise CPU math without JS GC lag.
- **WGSL (WebGPU):** Local client Graphics Card par millions of candles process karne ke liye.
- **C++ & CUDA:** Main server par HFT (High-Frequency Trading) aur ML ke liye.

**3 Render Engines:**
- **Canvas 2D:** Standard fallback (via WASM Memory).
- **GLSL (WebGL):** 144+ FPS fallback.
- **WGSL (WebGPU Render Pipeline):** The Ultimate Engine. Math aur Rendering dono same GPU VRAM me rahenge, jisse data transfer latency practically ZERO ho jayegi.

## Execution Rules
- **Strict Phase-by-Phase:** Ek phase tab tak leave nahi hoga jab tak wo 100% complete na ho.

- **MANDATORY SESSION LOGGING RULE**: At the end of EVERY session or task, YOU MUST automatically update the RESUME_CONTEXT.md file in the project root. You must log what you accomplished, what bugs were fixed, and what the next agent should do (Start Here). Format it as an 'Agent Conversation & Action History' entry, specifying who did what (e.g., 'Agent #2 fixed X and extracted Y'). Do NOT ask for permission to update this file, just do it automatically for every session.
