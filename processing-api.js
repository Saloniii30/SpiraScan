// Run one OpenCV job at a time to keep local memory usage predictable.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const maximumRequestBytes = 14 * 1024 * 1024;
let isProcessing = false;

function sendJson(response, status, data) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(data));
}

async function readRequest(request) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.length;

    if (totalBytes > maximumRequestBytes) {
      throw new Error('The upload is too large. Choose an image below 10 MB.');
    }

    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function runWorker(root, payload) {
  return new Promise((resolve, reject) => {
    const environmentPython = process.platform === 'win32'
      ? path.join(root, '.venv', 'Scripts', 'python.exe')
      : path.join(root, '.venv', 'bin', 'python');

    const python = process.env.SPIRASCAN_PYTHON || environmentPython;

    if (!existsSync(python)) {
      reject(new Error('OpenCV is not installed. Follow the Python setup in README.md.'));
      return;
    }

    const worker = spawn(python, [path.join(root, 'processing', 'worker.py')], {
      cwd: root,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let settled = false;

    function finish(error, result) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      if (error) {
        worker.kill();
        reject(error);
      } else {
        resolve(result);
      }
    }

    const timeout = setTimeout(() => {
      finish(new Error('Processing took too long. Try a smaller image.'));
    }, 45000);

    worker.stdout.on('data', (chunk) => {
      output += chunk.toString();

      if (output.length > 60 * 1024 * 1024) {
        finish(new Error('The generated previews are too large. Try a smaller image.'));
      }
    });

    // Drain errors without logging uploaded data or exposing local paths.
    worker.stderr.on('data', () => {});

    worker.on('error', () => {
      finish(new Error('Python could not start. Check the setup in README.md.'));
    });

    worker.stdin.on('error', () => {
      finish(new Error('The processing worker stopped. Check your Python dependencies.'));
    });

    worker.on('close', (code) => {
      if (settled) {
        return;
      }

      if (code !== 0) {
        finish(new Error('OpenCV could not start. Install requirements.txt and try again.'));
        return;
      }

      try {
        finish(null, JSON.parse(output));
      } catch {
        finish(new Error('The processing worker returned an unreadable result.'));
      }
    });

    worker.stdin.end(JSON.stringify(payload));
  });
}

export async function handleProcessing(request, response, root) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Use POST to process an image.' });
    return;
  }

 const origin = request.headers.origin;
const allowedOrigins = new Set([
  `http://${request.headers.host}`,
  `https://${request.headers.host}`
]);

if (origin && !allowedOrigins.has(origin)) {
    sendJson(response, 403, { error: 'Open the workspace from this local server.' });
    return;
  }

  if (!request.headers['content-type']?.startsWith('application/json')) {
    sendJson(response, 415, { error: 'The image request must use JSON.' });
    return;
  }

  if (isProcessing) {
    sendJson(response, 429, { error: 'Another image is processing. Please try again shortly.' });
    return;
  }

  isProcessing = true;

  try {
    const payload = await readRequest(request);

    if (!payload || typeof payload.image !== 'string' || !payload.image) {
      throw new Error('Select an image before processing.');
    }

    if (payload.options && (typeof payload.options !== 'object' || Array.isArray(payload.options))) {
      throw new Error('The processing settings are invalid.');
    }

    const result = await runWorker(root, payload);

    if (!result.ok) {
      sendJson(response, 422, { error: result.error });
      return;
    }

    sendJson(response, 200, result.result);
  } catch (error) {
    sendJson(response, 400, { error: error.message });
  } finally {
    isProcessing = false;
  }
}
