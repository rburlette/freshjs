import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const revision=process.argv[2] || 'b067bfd';
const hash=execFileSync('git',['rev-parse','--verify',revision+'^{commit}'],{encoding:'utf8'}).trim();
const directory=new URL('./.baseline/',import.meta.url);
await mkdir(directory,{recursive:true});
for(const [source,target] of [['fresh.js','fresh.js'],['benchmarks/fresh-table.js','fresh-table.js']]) {
  const text=execFileSync('git',['show',hash+':'+source],{encoding:'utf8'}).replace("'../fresh.js'", "'./fresh.js'");
  await writeFile(new URL(target,directory),text);
}
await writeFile(new URL('revision.txt',directory),hash+'\n');
console.log('Prepared standalone baseline '+hash);
