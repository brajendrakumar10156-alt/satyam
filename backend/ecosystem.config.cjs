module.exports = {
  apps: [
    {
      name: "my-fastapi-backend",
      script: "C:\\Users\\satya\\OneDrive\\Documents\\Desktop\\satyam\\.venv\\Scripts\\python.exe",
      args: "-m uvicorn main:app --host 0.0.0.0 --port 8000",
      cwd: "C:\\Users\\satya\\OneDrive\\Documents\\Desktop\\satyam\\backend",
      autorestart: true,
      watch: false
    }
  ]
};