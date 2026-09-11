import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const RAW = 'https://raw.githubusercontent.com/biomejs/website/main/';
const gh = (args) => execFileSync('gh', args, {
  encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' }, maxBuffer: 128e6,
});

const tree = JSON.parse(gh(['api', 'repos/biomejs/website/git/trees/main?recursive=1']));
const isDoc = (p) => p.startsWith('src/content/docs/en/') && (p.endsWith('.md') || p.endsWith('.mdx'));
const drop = (p) =>
  p.endsWith('/rules.mdx') || p.includes('/rules/') || p.endsWith('/sources.mdx') ||
  p.includes('/schemas/') || p.includes('changelog') || p.includes('/assist/actions/') ||
  p.includes('/languages/');

const all = tree.tree.filter(t => t.type === 'blob' && isDoc(t.path));
const keep = all.filter(t => !drop(t.path));
console.log(`blobs=${all.length} keep=${keep.length} bytes=${keep.reduce((a, b) => a + b.size, 0)}`);

const manifest = keep.map(t => ({ path: t.path, rel: t.path.replace('src/content/docs/en/', ''), size: t.size }));
const queue = [...manifest];

async function worker() {
  while (queue.length) {
    const item = queue.shift();
    const dest = path.join('en', item.rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    for (let i = 0; i < 4 && !item.ok; i++) {
      try {
        const r = await fetch(RAW + item.path);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        writeFileSync(dest, await r.text());
        item.ok = true;
      } catch (e) { item.err = String(e); await new Promise(r => setTimeout(r, 700)); }
    }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

manifest.sort((a, b) => a.rel.localeCompare(b.rel));
writeFileSync('manifest.json', JSON.stringify(manifest, null, 1));
console.log('FAILED:', manifest.filter(m => !m.ok).map(m => m.rel).join(', ') || 'none');
console.log(manifest.map(m => m.rel + '  ' + m.size).join('\n'));
