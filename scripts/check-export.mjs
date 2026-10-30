import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import assert from 'node:assert/strict';

// These are task-source directories only. Never traverse machine or Git metadata.
const delivered = ['.gitignore', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'README.md', 'DESIGN.md', 'src', 'public', 'dist', 'test', 'scripts', 'licenses', 'artifacts'];
const files = [];
async function walk(path) {
  if (path === 'test/scratch' || path.split('/').some(p => ['node_modules', '.vite', '.git', '.github'].includes(p) || p.startsWith('.env'))) return;
  const info = await stat(path);
  if (info.isDirectory()) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      assert.equal(entry.isSymbolicLink(), false, `Unexpected submission symlink: ${path}/${entry.name}`);
      await walk(join(path, entry.name));
    }
  } else { files.push({ path, bytes: info.size }); }
}
for (const path of delivered) await walk(path);
const html = await readFile('dist/index.html', 'utf8');
for (const attribute of html.matchAll(/(?:src|href|content)="(\.\/[^"#]+)"/g)) {
  const target = attribute[1].slice(2);
  assert.ok((await stat(join('dist', target))).size > 0, `Missing relative asset: ${target}`);
}
assert.ok(html.includes('og:image') && html.includes('./og-image.png'));
for (const file of files.filter(file => file.path.startsWith('dist/'))) {
  assert.ok(!['.map', '.tgz', '.ts', '.tsx'].includes(extname(file.path)), `Unexpected export artifact: ${file.path}`);
}
const budgetPath = 'artifacts/bundle-budget.json';
const withoutBudget = files.filter(f => f.path !== budgetPath);
const budget = {
  limitBytes: 8_388_608,
  totalBytes: 0,
  productionExportBytes: withoutBudget.filter(f => f.path.startsWith('dist/')).reduce((sum, f) => sum + f.bytes, 0),
  ignoredPaths: { '**/node_modules/': 0, '**/.vite/': 0, 'test/scratch/': 0 },
  files: withoutBudget.sort((a, b) => a.path.localeCompare(b.path)),
};
const baseBytes = withoutBudget.reduce((sum, file) => sum + file.bytes, 0);
let output = '';
for (let iteration = 0; iteration < 5; iteration++) {
  output = JSON.stringify(budget, null, 2) + '\n';
  budget.totalBytes = baseBytes + Buffer.byteLength(output);
}
output = JSON.stringify(budget, null, 2) + '\n';
assert.ok(budget.totalBytes < budget.limitBytes, 'Submission exceeds 8 MiB');
await writeFile(budgetPath, output);
console.log(JSON.stringify({ totalBytes: budget.totalBytes, productionExportBytes: budget.productionExportBytes, limitBytes: budget.limitBytes, files: withoutBudget.length + 1, relativeAssets: 'present', unnecessaryExportArtifacts: 'none' }, null, 2));
