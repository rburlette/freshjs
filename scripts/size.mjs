import {readFile} from 'node:fs/promises';
import {gzipSync,brotliCompressSync,constants} from 'node:zlib';
import {execFileSync} from 'node:child_process';
const compress = data => ({raw:data.length,gzip:gzipSync(data,{level:9}).length,brotli:brotliCompressSync(data,{params:{[constants.BROTLI_PARAM_QUALITY]:11}}).length});
const result = {'FreshJS current (unminified)':compress(await readFile(new URL('../fresh.js',import.meta.url)))};
try {result['FreshJS original 313f006 (unminified)']=compress(execFileSync('git',['show','313f006:fresh.js']));} catch { /* A shallow checkout may not contain the baseline. */ }
for(const [label,file] of [['Preact production ESM','preact/dist/preact.module.js'],['Vue production runtime ESM (no template compiler)','vue/dist/vue.runtime.esm-browser.prod.js']]) {
  result[label]=compress(await readFile(new URL('../node_modules/'+file,import.meta.url)));
}
console.table(result);
console.log('Bytes; runtime files only, independently compressed. No FreshJS minification or build is required.');
