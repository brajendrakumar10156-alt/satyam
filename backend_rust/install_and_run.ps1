Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "QuantaAI - Installing The Best Language (Rust)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# Check if cargo is installed
if (Get-Command cargo -ErrorAction SilentlyContinue) {
    Write-Host "[*] Rust (Cargo) is already installed!" -ForegroundColor Green
} else {
    Write-Host "[*] Rust is not installed. Downloading rustup-init..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://win.rustup.rs" -OutFile "rustup-init.exe"
    
    Write-Host "[*] Installing Rust toolchain (Silent Mode with GNU linker)..." -ForegroundColor Yellow
    .\rustup-init.exe -y --default-host i686-pc-windows-gnu
    
    # Reload environment variables for the current session
    $env:Path += ";$env:USERPROFILE\.cargo\bin"
    
    Write-Host "[*] Cleaning up installer..."
    Remove-Item "rustup-init.exe"
    
    Write-Host "[SUCCESS] Rust installed successfully!" -ForegroundColor Green
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Compiling the World's Fastest Backend (Native)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

rustup default stable-i686-pc-windows-gnu
rustup default stable-i686-pc-windows-gnu
    cargo build --release --target i686-pc-windows-gnu

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Starting the Native Server on Port 3030..." -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

cargo run --release --target i686-pc-windows-gnu


