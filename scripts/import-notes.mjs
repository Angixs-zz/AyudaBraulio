// Ingesta reproducible: conserva el texto original y su huella, sin corregirlo.
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, basename } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(process.argv[2] || '../Conmutacion');
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path));
    else if (entry.name.endsWith('.md')) {
      const content = await readFile(path, 'utf8');
      result.push({ path: relative(root, path).split('\\').join('/'), title: basename(path, '.md'), content, sha256: createHash('sha256').update(content).digest('hex') });
    }
  }
  return result;
}
const notes = await walk(root);
await mkdir('public/apuntes', { recursive: true });
await writeFile('public/apuntes/originales.json', JSON.stringify({ source: 'Apuntes locales de Conmutación proporcionados por Angixs', notes }, null, 2) + '\n');
console.log(`Importados ${notes.length} apuntes (${notes.filter(n => n.content.trim()).length} con contenido).`);
