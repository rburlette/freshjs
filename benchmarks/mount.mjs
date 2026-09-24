import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
import {serve} from '../scripts/server.mjs';
const server=await serve(0);
let browser;
try {
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:process.env.CHROMIUM_PATH?['--no-sandbox','--no-zygote']:[]});
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/tests/`);
  const samples=await page.evaluate(async()=>{
    const {freshElement}=await import('/fresh.js');
    const results=[];
    for(let sample=0;sample<15;sample++) for(const count of [0,100,1000]) {
      const tag=`mount-test-${sample}-${count}`;
      const rows=Array.from({length:count},(_,id)=>({id,label:'Row '+id}));
      customElements.define(tag,class extends freshElement {
        constructor(){
          super('<table><tbody><tr fjs-for="row in this.rows" fjs-key="row.id"><td>{{row.id}}</td><td>{{row.label}}</td></tr></tbody></table>');
          this.rows=rows;
        }
      });
      const pair={count};
      for(const kind of ['first','cached']) {
        await new Promise(requestAnimationFrame);
        const start=performance.now();
        const element=document.createElement(tag);document.body.append(element);element.refresh();
        await Promise.resolve();void element.offsetHeight;
        pair[kind]=performance.now()-start;
        if(element.shadowRoot.querySelectorAll('tr').length!==count) throw new Error('Invalid mount');
        element.remove();
      }
      results.push(pair);
    }
    return results;
  });
  const result={date:new Date().toISOString(),browser:browser.version(),description:'FreshJS template compilation vs cached template, including construction, attach, refresh, and forced layout; excludes module loading and data generation. Same two-column keyed table. 15 pairs per size; first/cached order is fixed, so JIT/order effects are not separated.',samples};
  await writeFile(new URL('./mount.local.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
  const median=arr=>arr.toSorted((a,b)=>a-b)[Math.floor(arr.length/2)];
  console.table([0,100,1000].map(count=>({rows:count,firstMs:median(samples.filter(x=>x.count===count).map(x=>x.first)),cachedMs:median(samples.filter(x=>x.count===count).map(x=>x.cached))})));
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
