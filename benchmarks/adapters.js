// Dynamically load only the library under measurement. Every adapter uses a
// shadow root, identical table markup, per-row handlers, and stable ID keys.
export async function createAdapter(name, mount) {
  let host, root, commit, dispose;
  const state = {rows: [], selected: null};
  const select = id => {state.selected = id; return commit();};
  const remove = id => {state.rows = state.rows.filter(row => row.id !== id); return commit();};
  if(name === 'fresh' || name === 'fresh-before') {
    if(name === 'fresh-before') await import('./.baseline/fresh-table.js');
    else await import('./fresh-table.js');
    host = document.createElement('fresh-benchmark');
    host.select = select; host.remove = remove;
    root = host.shadowRoot;
    commit = () => {host.rows = state.rows; host.selected = state.selected; host.refresh();};
  } else {
    host = document.createElement('div'); root = host.attachShadow({mode:'open'});
    const nodes = h => h('table',{class:'table table-hover table-striped test-data'}, [h('tbody',null,state.rows.map(row => h('tr',{key:row.id,class:row.id === state.selected ? 'danger' : ''},[
      h('td',{class:'col-md-1'},String(row.id)),
      h('td',{class:'col-md-4'},[h('a',{onClick:() => select(row.id)},row.label)]),
      h('td',{class:'col-md-1'},[h('a',{onClick:() => remove(row.id)},[h('span',{class:'glyphicon glyphicon-remove','aria-hidden':'true'})])]),
      h('td',{class:'col-md-6'})
    ])))]);
    if(name === 'preact') {
      const {h, render} = await import('../node_modules/preact/dist/preact.module.js');
      commit = () => render(nodes(h),root);
      dispose = () => render(null,root);
    } else if(name === 'vue') {
      const {h, render} = await import('../node_modules/vue/dist/vue.runtime.esm-browser.prod.js');
      commit = () => render(nodes(h),root);
      dispose = () => render(null,root);
    } else if(name === 'vanilla') {
      root.innerHTML = '<table class="table table-hover table-striped test-data"><tbody></tbody></table>';
      const body = root.querySelector('tbody'); let rows = new Map();
      commit = () => {
        const next = new Map();
        for(const item of state.rows) {
          let row = rows.get(item.id);
          if(!row) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td class="col-md-1"></td><td class="col-md-4"><a></a></td><td class="col-md-1"><a><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></a></td><td class="col-md-6"></td>';
            row = {tr,label:tr.children[1].firstChild};
            tr.firstChild.textContent = item.id;
            row.label.onclick = () => select(item.id);
            tr.children[2].firstChild.onclick = () => remove(item.id);
          }
          if(row.label.textContent !== item.label) row.label.textContent = item.label;
          const cls = item.id === state.selected ? 'danger' : '';
          if(row.tr.className !== cls) row.tr.className = cls;
          next.set(item.id,row);
        }
        for(const [id,row] of rows) if(!next.has(id)) row.tr.remove();
        let anchor = null;
        for(const row of [...next.values()].reverse()) {
          if(row.tr.parentNode !== body || row.tr.nextSibling !== anchor) body.insertBefore(row.tr,anchor);
          anchor = row.tr;
        }
        rows = next;
      };
    } else throw new Error('Unknown adapter: ' + name);
  }
  const style = document.createElement('style');
  style.textContent = ':host{display:block}table{border-collapse:collapse;width:100%}td{padding:2px 8px}tr.danger{background:#f2dede}a{cursor:pointer}.col-md-1{width:8.333%}.col-md-4{width:33.333%}.col-md-6{width:50%}';
  // Append shared CSS after the initial renderer commit.
  mount.append(host);
  commit();
  root.append(style);
  await Promise.resolve();
  return {state,root,host,commit,dispose:()=>{dispose?.();host.remove();}};
}
