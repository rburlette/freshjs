import {mkdir, readFile, writeFile, copyFile, access} from 'node:fs/promises';
import {resolve, join} from 'node:path';
const checkout = process.argv[2];
if(!checkout) throw new Error('Usage: node benchmarks/export-standard.mjs /path/to/js-framework-benchmark');
await access(resolve(checkout, 'webdriver-ts'));
const target = resolve(checkout, 'frameworks/keyed/freshjs');
await mkdir(target); // Refuse to overwrite an existing implementation.
for(const file of ['index.html','package.json']) await copyFile(new URL('./js-framework-benchmark/'+file, import.meta.url),join(target,file));
for(const [source, name] of [['../fresh.js','fresh.js'],['./data.js','data.js'],['./fresh-table.js','fresh-table.js'],['./js-framework-benchmark/app.js','app.js']]) {
  const content = (await readFile(new URL(source,import.meta.url),'utf8')).replaceAll("'../fresh.js'", "'./fresh.js'").replaceAll("'../fresh-table.js'", "'./fresh-table.js'").replaceAll("'../data.js'", "'./data.js'");
  await writeFile(join(target,name),content);
}
console.log(target);
