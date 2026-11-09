import { cp, lstat, mkdir, rm } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = ['index.html', 'styles.css', 'app.js', 'booking.js', 'appointments.js',
  'suggestions.js', 'ui-shell.js', 'icons.svg', 'sen-logo.svg', 'icons-LICENSE.txt'];

export async function buildStaticSite({ outputDir = join(root, 'dist') } = {}) {
  const target = resolve(outputDir);
  const rootFromTarget = relative(target, root);
  if (basename(target) !== 'dist' || !rootFromTarget ||
      (!rootFromTarget.startsWith('..') && !isAbsolute(rootFromTarget))) {
    throw new Error('Build output must be a separate directory named dist.');
  }
  const existing = await lstat(target).catch(error => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  if (existing?.isSymbolicLink()) throw new Error('Build output must not be a symbolic link.');
  // The resolved target is a dedicated dist directory, never the source or its ancestor.
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await Promise.all(files.map(file => cp(join(root, file), join(target, file))));
  return { outputDir: target, files: [...files] };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const result = await buildStaticSite();
  console.log(`Built ${result.files.length} public files in dist.`);
}
