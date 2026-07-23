use std::process::Command;
use std::thread;

/// ====================================================================
/// QUANTA AI - ULTIMATE NATIVE TASK RUNNER (Replaces package.json)
/// Written in Rust (The Best to Best Language)
/// ====================================================================
fn main() {
    println!("🚀 [QUANTA RUNNER] Starting all services without JSON overhead...\n");

    // Task 1: Start the Frontend using Bun (Blazing Fast)
    let frontend = thread::spawn(|| {
        println!("🌐 [FRONTEND] Starting Vite via Bun...");
        let status = Command::new("bunx")
            .arg("--bun")
            .arg("vite")
            .arg("--host")
            .status()
            .expect("Failed to start frontend");
        println!("🌐 [FRONTEND] Exited with status: {}", status);
    });

    // Task 2: Start the Python Backend (Native & Instant)
    let backend = thread::spawn(|| {
        println!("🧠 [BACKEND] Starting UV Uvicorn Server...");
        let status = Command::new("backend\\venv\\Scripts\\python.exe")
            .current_dir("backend")
            .arg("-m")
            .arg("uvicorn")
            .arg("main:app")
            .arg("--host").arg("0.0.0.0")
            .arg("--port").arg("8000")
            .arg("--reload")
            .status()
            .expect("Failed to start backend");
        println!("🧠 [BACKEND] Exited with status: {}", status);
    });

    // Task 3: Start the Native Rust AI Supervisor
    let rust_supervisor = thread::spawn(|| {
        println!("⚙️  [SUPERVISOR] Starting Native Rust Backend...");
        let status = Command::new("cargo")
            .current_dir("backend_rust")
            .arg("run")
            .arg("--release")
            .status()
            .expect("Failed to start Rust backend");
        println!("⚙️  [SUPERVISOR] Exited with status: {}", status);
    });

    println!("✅ [SUCCESS] All systems running at maximum performance.");
    println!("====================================================================");
    
    // Wait for all threads (they run infinitely until user presses Ctrl+C)
    frontend.join().unwrap();
    backend.join().unwrap();
    rust_supervisor.join().unwrap();
}
