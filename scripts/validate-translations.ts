import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

import { validateTranslationCatalogs } from '../src/features/localization/catalog-validation.ts';

const textExtensions = new Set([
  '.json',
  '.md',
  '.ts',
  '.tsx',
  '.txt',
  '.yml',
  '.yaml',
]);
const roots = ['app', 'assets', 'docs', 'scripts', 'src', 'supabase', 'tests'];
const standalone = ['.env.example', '.gitignore', 'README.md', 'app.json', 'eslint.config.js', 'expo-env.d.ts', 'metro.config.js', 'package-lock.json', 'package.json', 'tsconfig.json'];

const files = [
  ...(await Promise.all(roots.map((root) => collect(root)))).flat(),
  ...standalone,
];
const utf8Issues: string[] = [];
const decoder = new TextDecoder('utf-8', { fatal: true });

for (const file of files) {
  try {
    decoder.decode(await readFile(file));
  } catch {
    utf8Issues.push(file);
  }
}

const catalogIssues = validateTranslationCatalogs();
if (utf8Issues.length || catalogIssues.length) {
  for (const file of utf8Issues) process.stderr.write(`invalid_utf8 ${file}\n`);
  for (const issue of catalogIssues) {
    process.stderr.write(`${issue.reason} ${issue.language} ${issue.key}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(`Validated ${files.length} UTF-8 files and 5 complete translation catalogs.\n`);
}

async function collect(path: string): Promise<string[]> {
  const value = await stat(path);
  if (value.isFile()) return textExtensions.has(extname(path)) ? [path] : [];
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => collect(join(path, entry.name))),
  );
  return nested.flat();
}
