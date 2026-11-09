import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const candidates = ['../faq/.venv/Scripts/python.exe', '../faq/.venv/bin/python.exe'];
const local = candidates.map(path => fileURLToPath(new URL(path, import.meta.url))).find(existsSync);
const result = spawnSync(local ?? 'python', [fileURLToPath(new URL('./import-catalog.py', import.meta.url))], { stdio:'inherit', windowsHide:true });
if (result.error) console.error('Không chạy được Python. Cài môi trường crawler theo README dữ liệu rồi thử lại.');
process.exitCode = result.status ?? 1;
