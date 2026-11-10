import { cp, mkdir, rm, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, 'dist');
const relativeOutput = path.relative(root, output);
if (!relativeOutput || relativeOutput.startsWith('..') || path.isAbsolute(relativeOutput)) {
  throw new Error('Build output must stay inside the project folder.');
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const publicFiles = [
  'index.html', 'agenda.html', 'evento.html', 'chino.html',
  'agenda.js', 'agenda-page.js', 'evento-page.js', 'chino.js', 'presentation.js',
];
for (const file of publicFiles) await copyFile(path.join(root, file), path.join(output, file));
await cp(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });
