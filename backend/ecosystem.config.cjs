module.exports = {
  apps: [
    {
      name: "rust-backend-engine",
      script: "C:\\Users\\satya\\OneDrive\\Documents\\Desktop\\satyam\\backend_rust\\target\\debug\\backend_rust.exe",
      cwd: "C:\\Users\\satya\\OneDrive\\Documents\\Desktop\\satyam\\backend_rust",
      autorestart: true,
      watch: false
    },
    {
      name: "rust-collector-engine",
      script: "C:\\Users\\satya\\OneDrive\\Documents\\Desktop\\satyam\\backend_rust_collector\\target\\debug\\backend_rust_collector.exe",
      cwd: "C:\\Users\\satya\\OneDrive\\Documents\\Desktop\\satyam\\backend_rust_collector",
      autorestart: true,
      watch: false
    }
  ]
};