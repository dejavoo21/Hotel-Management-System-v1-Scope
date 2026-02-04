import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { config } from '../config/index.js';

type ScanResult =
  | { status: 'clean' }
  | { status: 'infected'; output: string }
  | { status: 'error'; output: string };

type HealthResult =
  | { status: 'disabled' }
  | { status: 'ok'; version: string }
  | { status: 'error'; output: string };

async function writeTempFile(buffer: Buffer, filename: string): Promise<string> {
  const safeName = filename.replace(/[^\w.-]+/g, '_');
  const tempName = `laflo-scan-${crypto.randomUUID()}-${safeName}`;
  const tempPath = path.join(os.tmpdir(), tempName);
  await fs.writeFile(tempPath, buffer);
  return tempPath;
}

async function runClamScan(filePath: string): Promise<ScanResult> {
  const timeoutMs = config.clamav.timeoutMs;

  return new Promise((resolve) => {
    const args = ['--no-summary', '--stdout', filePath];
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(config.clamav.path, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      resolve({ status: 'error', output: `ClamAV launch failed: ${(err as Error).message}` });
      return;
    }

    let stdout = '';
    let stderr = '';
    let finished = false;

    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill('SIGKILL');
      resolve({ status: 'error', output: 'ClamAV scan timed out.' });
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);

      const output = `${stdout}${stderr}`.trim();
      if (code === 0) {
        resolve({ status: 'clean' });
        return;
      }
      if (code === 1) {
        resolve({ status: 'infected', output: output || 'Infected file detected.' });
        return;
      }
      resolve({ status: 'error', output: output || `ClamAV error (code ${code ?? 'unknown'}).` });
    });

    child.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve({ status: 'error', output: `ClamAV launch failed: ${err.message}` });
    });
  });
}

export async function scanAttachment(buffer: Buffer, filename: string): Promise<ScanResult> {
  if (!config.clamav.enabled) {
    return { status: 'clean' };
  }

  if (buffer.length > config.clamav.maxBytes) {
    return {
      status: 'error',
      output: `Attachment exceeds scan size limit (${config.clamav.maxBytes} bytes).`,
    };
  }

  const tempPath = await writeTempFile(buffer, filename);
  try {
    const result = await runClamScan(tempPath);
    if (result.status === 'infected') {
      console.warn(`Attachment blocked by malware scan: ${result.output}`);
    } else if (result.status === 'error') {
      console.error(`Attachment scan failed: ${result.output}`);
    }
    return result;
  } finally {
    await fs.unlink(tempPath).catch(() => undefined);
  }
}

export async function checkClamAvHealth(): Promise<HealthResult> {
  if (!config.clamav.enabled) {
    return { status: 'disabled' };
  }

  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(config.clamav.path, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      resolve({ status: 'error', output: `ClamAV launch failed: ${(err as Error).message}` });
      return;
    }

    let stdout = '';
    let stderr = '';
    let finished = false;

    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill('SIGKILL');
      resolve({ status: 'error', output: 'ClamAV health check timed out.' });
    }, Math.min(config.clamav.timeoutMs, 5000));

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      const output = `${stdout}${stderr}`.trim();
      if (code === 0 && output) {
        resolve({ status: 'ok', version: output });
        return;
      }
      resolve({ status: 'error', output: output || `ClamAV error (code ${code ?? 'unknown'}).` });
    });

    child.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve({ status: 'error', output: `ClamAV launch failed: ${err.message}` });
    });
  });
}
