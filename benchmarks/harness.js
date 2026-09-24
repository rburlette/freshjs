import {createAdapter} from './adapters.js';
import {buildData} from './data.js';
const name = new URLSearchParams(location.search).get('library') || 'fresh';
const adapter = await createAdapter(name, document.querySelector('#mount'));
const {state, root, host} = adapter;
const random = () => { let seed = 42; return () => ((seed = (Math.imul(seed,1664525) + 1013904223) >>> 0) / 4294967296); };
const rows = n => buildData(n,random());
const frame = () => new Promise(requestAnimationFrame);
async function commit() {await adapter.commit();}
function check() {
  const rendered = [...root.querySelectorAll('tbody tr')];
  if(rendered.length !== state.rows.length) throw new Error('Wrong row count');
  for(let i=0;i<rendered.length;i++) {
    const tr = rendered[i], row = state.rows[i];
    if(tr.children.length !== 4 || tr.children[0].textContent !== String(row.id) || tr.children[1].textContent !== row.label || tr.classList.contains('danger') !== (row.id === state.selected)) throw new Error('Incorrect row at ' + i);
    if(!tr.querySelector('span.glyphicon-remove[aria-hidden="true"]')) throw new Error('Missing remove icon');
  }
}
const cases = ['create1000','create10000','replace1000','update10th','updateOne','select','swap','remove','append1000','shrink','clear','unchanged'];
window.benchmark = {
  name, cases,
  async verify() {
    state.rows = rows(1000); state.selected = null; await commit(); check();
    const previous = [...root.querySelectorAll('tr')];
    [state.rows[1],state.rows[998]] = [state.rows[998],state.rows[1]];
    await commit(); check();
    const moved = [...root.querySelectorAll('tr')];
    if(moved[1] !== previous[998] || moved[998] !== previous[1] || moved[500] !== previous[500]) throw new Error('Keyed identity lost');
    moved[1].children[1].firstChild.click(); await Promise.resolve(); check();
    if(state.selected !== state.rows[1].id) throw new Error('Stale selection handler');
    const removedId = state.rows[1].id;
    moved[1].children[2].firstChild.click(); await Promise.resolve(); check();
    if(state.rows.some(row=>row.id===removedId)) throw new Error('Remove handler failed');
    state.rows = []; await commit(); check();
    return true;
  },
  async sample(operation) {
    state.rows = operation.startsWith('create') ? [] : rows(1000);
    state.selected = null; await commit();
    // Data generation, setup and correctness checks are outside the measured interval.
    const replacement = rows(operation === 'create10000' ? 10000 : 1000);
    const before = new Map([...root.querySelectorAll('tr')].map(tr=>[Number(tr.children[0].textContent),tr]));
    void host.offsetHeight; await frame();
    const start = performance.now();
    switch(operation) {
      case 'create1000': case 'create10000': case 'replace1000': state.rows = replacement; break;
      case 'update10th': for(let i=0;i<state.rows.length;i+=10) state.rows[i].label += ' !!!'; break;
      case 'updateOne': state.rows[500].label += ' !!!'; break;
      case 'select': state.selected = state.rows[500].id; break;
      case 'swap': [state.rows[1],state.rows[998]] = [state.rows[998],state.rows[1]]; break;
      case 'remove': state.rows.splice(500,1); break;
      case 'append1000': state.rows = state.rows.concat(replacement); break;
      case 'shrink': state.rows = state.rows.slice(0,10); break;
      case 'clear': state.rows = []; break;
      case 'unchanged': break;
      default: throw new Error('Unknown operation');
    }
    await commit();
    const domMs = performance.now() - start;
    void host.offsetHeight;
    const layoutMs = performance.now() - start;
    check();
    for(const tr of root.querySelectorAll('tr')) {
      const id = Number(tr.children[0].textContent);
      if(before.has(id) && before.get(id) !== tr) throw new Error('Row identity lost for '+id);
    }
    return {domMs, layoutMs};
  }
};
