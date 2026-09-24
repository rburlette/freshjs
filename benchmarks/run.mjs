import {chromium} from 'playwright';
import {writeFile, readFile} from 'node:fs/promises';
import {cpus, platform, release} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {serve} from '../scripts/server.mjs';
const samples = Number(process.env.SAMPLES || 15);
const warmups = Number(process.env.WARMUPS || 3);
if(!Number.isInteger(samples) || samples < 1 || !Number.isInteger(warmups) || warmups < 0) throw new Error('Invalid sample count');
const libraries = (process.env.LIBRARIES || 'fresh,preact,vue,vanilla').split(',');
const args = process.env.CHROMIUM_PATH ? ['--no-sandbox','--disable-dev-shm-usage','--no-zygote'] : [];
const server = await serve(0);
const url = `http://127.0.0.1:${server.address().port}/benchmarks/`;
let browser;
const result = {date:new Date().toISOString(), samples, warmups, metric:'DOM commit and DOM commit + forced layout (ms); excludes data generation, network, parse, paint, and validation', node:process.version, os:`${platform()} ${release()}`, cpu:cpus()[0]?.model, cpuCount:cpus().length, args, libraries:{}, results:{}};
try {
  try {
    const options = {encoding:'utf8',stdio:['ignore','pipe','ignore']};
    result.commit = execFileSync('git',['rev-parse','HEAD'],options).trim();
    result.dirty = Boolean(execFileSync('git',['status','--porcelain'],options).trim());
  } catch { result.commit = null; result.dirty = null; }
  result.sourceSHA256 = {};
  for(const file of ['fresh.js','benchmarks/adapters.js','benchmarks/harness.js','benchmarks/data.js','package-lock.json'])
    result.sourceSHA256[file] = createHash('sha256').update(await readFile(new URL('../'+file,import.meta.url))).digest('hex');
  result.browserPackage = process.env.CHROMIUM_PATH || 'Playwright bundled Chromium';
  browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args});
  result.browser = browser.version();
  for(const name of libraries) {
    result.libraries[name] = ['preact','vue'].includes(name) ? JSON.parse(await readFile(new URL('../node_modules/'+name+'/package.json',import.meta.url),'utf8')).version : name === 'fresh' ? result.commit || 'unversioned source; see sourceSHA256' : name === 'fresh-before' ? (await readFile(new URL('./.baseline/revision.txt',import.meta.url),'utf8')).trim() : 'handwritten keyed DOM reference';
    result.results[name] = {};
  }
  // Rotate library order between rounds to reduce systematic order/thermal bias.
  for(let round=-warmups; round<samples; round++) {
    const offset = (round+warmups) % libraries.length;
    const order = libraries.slice(offset).concat(libraries.slice(0,offset));
    for(const name of order) {
      const page = await browser.newPage({viewport:{width:1280,height:800}});
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url+'?library='+name);
      await page.waitForFunction(()=>Boolean(window.benchmark));
      await page.evaluate(()=>window.benchmark.verify());
      // Warm every operation in every fresh page; compilation/JIT state is reset per page.
      const cases = await page.evaluate(()=>window.benchmark.cases);
      for(const operation of cases) {
        await page.evaluate(op=>window.benchmark.sample(op),operation);
        const sample = await page.evaluate(op=>window.benchmark.sample(op),operation);
        if(round>=0) (result.results[name][operation] ||= []).push(sample);
      }
      if(errors.length) throw new Error(name+': '+errors.join('; '));
      await page.close();
    }
    console.log(`${round<0?'Warmup':'Sample'} ${round<0?round+warmups+1:round+1}/${round<0?warmups:samples} complete`);
  }
  const median = values => {const a=values.toSorted((a,b)=>a-b); return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
  const summary={};
  for(const name of libraries) for(const [op,values] of Object.entries(result.results[name])) {
    summary[op] ||= {};
    summary[op][name] = Number(median(values.map(x=>x.layoutMs)).toFixed(3));
  }
  result.medianLayoutMs=summary;
  await writeFile(new URL('./results.local.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
  console.table(summary);
} finally {await browser?.close(); await new Promise(resolve=>server.close(resolve));}
