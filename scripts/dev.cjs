const http = require('node:http');
const { spawn } = require('node:child_process');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];
let shuttingDown = false;

function backendIsHealthy() {
  return new Promise((resolve) => {
    const request = http.get('http://127.0.0.1:8000/health', (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.setTimeout(500, () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

function startProcess(scriptName) {
  const child = spawn(npmCommand, ['run', scriptName], {
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`${scriptName} stopped (${signal || code || 0})`);
    shutdown(code || 1);
  });
  return child;
}

function stopProcess(child) {
  if (!child.pid || child.exitCode !== null) return;
  try {
    if (process.platform === 'win32') child.kill('SIGTERM');
    else process.kill(-child.pid, 'SIGTERM');
  } catch {}
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  children.forEach(stopProcess);
  setTimeout(() => process.exit(exitCode), 250);
}

async function main() {
  if (!(await backendIsHealthy())) startProcess('backend');
  startProcess('frontend');
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
main().catch((error) => {
  console.error(error);
  shutdown(1);
});
