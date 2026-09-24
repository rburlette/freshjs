import {test, expect} from '@playwright/test';

test.beforeEach(async ({page}) => {
  await page.goto('/tests/');
  await page.evaluate(async () => {
    const {freshElement} = await import('/fresh.js');
    let count = 0;
    window.mount = (template, state = {}) => {
      const tag = 'test-component-' + ++count;
      customElements.define(tag, class extends freshElement {
        constructor() { super(template); Object.assign(this, state); }
      });
      const element = document.createElement(tag);
      document.body.append(element);
      return element;
    };
  });
});

test('standalone initial render, cached clones, text boundaries and inert content', async ({page}) => {
  expect(await page.evaluate(async () => {
    const el = mount('<style>/* {{invalid}} */</style><!-- comment --><b>A{{this.a}}B{{this.b}}C</b><i>{{this.a}}</i>', {a: 1, b: 2});
    await Promise.resolve();
    const clone = document.createElement(el.localName);
    document.body.append(clone);
    await Promise.resolve();
    return [el.shadowRoot.querySelector('b').textContent, el.shadowRoot.querySelector('i').textContent, clone.shadowRoot.querySelector('b').textContent];
  })).toEqual(['A1B2C', '1', 'A1B2C']);
});

test('function properties replace, capture current item/index, and clear', async ({page}) => {
  expect(await page.evaluate(() => {
    const el = mount('<button fjs-for="row in this.rows" [.onclick]="() => this.hit(row.id, index)">{{row.id}}</button>', {rows: [{id: 1}, {id: 2}], hits: [], hit(id, i) { this.hits.push([id, i]); }});
    el.refresh();
    el.rows = [{id: 3}, {id: 1}]; el.refresh();
    el.shadowRoot.querySelector('button').click();
    const other = mount('<button [.onclick]="this.handler">click</button>', {handler() {}});
    other.refresh(); other.handler = null; other.refresh();
    return {hits: el.hits, handler: other.shadowRoot.querySelector('button').onclick};
  })).toEqual({hits: [[3, 0]], handler: null});
});

test('null lists, shrinking, clear and regrow release rows', async ({page}) => {
  expect(await page.evaluate(() => {
    const el = mount('<i fjs-for="this.rows">{{item}}</i>', {rows: null});
    el.refresh(); el.rows = [1,2,3]; el.refresh();
    const removed = el.shadowRoot.querySelectorAll('i')[1];
    el.rows = [4]; el.refresh();
    const retained = el.templateInstance.binders[0].rows.length;
    el.rows = [4,5]; el.refresh();
    const reused = el.shadowRoot.querySelectorAll('i')[1] === removed;
    el.rows = undefined; el.refresh();
    return [retained, reused, el.shadowRoot.querySelectorAll('i').length];
  })).toEqual([1, false, 0]);
});

test('keyed rows preserve identity, update closures and reject duplicate keys atomically', async ({page}) => {
  expect(await page.evaluate(() => {
    const el = mount('<div fjs-for="row in this.rows" fjs-key="row.id"><input><button [.onclick]="() => this.hits.push([row.label, index])">{{row.label}}</button></div>', {rows: [{id:1,label:'a'}, {id:2,label:'b'}, {id:3,label:'c'}], hits: []});
    el.refresh();
    const original = [...el.shadowRoot.querySelectorAll('div')];
    original[1].querySelector('input').value = 'draft';
    el.rows = [{id:3,label:'C'}, {id:2,label:'B'}, {id:1,label:'A'}]; el.refresh();
    const reordered = [...el.shadowRoot.querySelectorAll('div')];
    reordered[0].querySelector('button').click();
    const before = el.shadowRoot.innerHTML;
    el.rows = [{id:1}, {id:1}];
    let error; try {el.refresh();} catch(e) {error = e.message;}
    return {identity: reordered.map((node,i) => node === original[2-i]), draft: reordered[1].querySelector('input').value, hits: el.hits, error, unchanged: before === el.shadowRoot.innerHTML};
  })).toEqual({identity:[true,true,true], draft:'draft', hits:[['C',0]], error:'Duplicate fjs-key: 1', unchanged:true});
});

test('keyed unchanged refresh performs no DOM mutations', async ({page}) => {
  expect(await page.evaluate(() => {
    const el = mount('<div fjs-for="this.rows" fjs-key="item.id">{{item.label}}</div>', {rows:[{id:1,label:'a'},{id:2,label:'b'}]});
    el.refresh();
    const observer = new MutationObserver(() => {});
    observer.observe(el.shadowRoot, {subtree:true, childList:true, characterData:true, attributes:true});
    el.refresh();
    return observer.takeRecords().length;
  })).toBe(0);
});

test('nested lists, conditionals, trailing bindings and select options', async ({page}) => {
  expect(await page.evaluate(() => {
    const el = mount('<section fjs-if="this.show"><div fjs-for="group in this.groups"><b>{{group.name}}</b><i fjs-for="row in group.rows">{{row}}</i></div></section><select [.value]="this.choice"><option fjs-for="this.options" [.value]="item">{{item}}</option></select><em>{{this.end}}</em>', {show:true, groups:[{name:'g',rows:['x','y']}], choice:'b', options:['a','b'], end:'done'});
    el.refresh();
    const text = el.shadowRoot.querySelector('section').textContent;
    const value = el.shadowRoot.querySelector('select').value;
    el.show = false; el.refresh(); el.show = true; el.groups[0].rows = ['z']; el.refresh();
    return [text,value,el.shadowRoot.querySelector('section').textContent,el.shadowRoot.querySelector('em').textContent];
  })).toEqual(['gxy','b','gz','done']);
});

test('parent assigns child props before its initial render', async ({page}) => {
  expect(await page.evaluate(async () => {
    const {freshElement} = await import('/fresh.js');
    customElements.define('test-child', class extends freshElement {constructor(){super('<b>{{this.info.name}}</b>');}});
    const el = mount('<test-child [.info]="this.info"></test-child>', {info:{name:'first'}});
    await Promise.resolve();
    el.info = {name:'second'}; el.refresh();
    return el.shadowRoot.querySelector('test-child').shadowRoot.textContent;
  })).toBe('second');
});

test('requestRefresh batches and explicit refresh consumes pending work', async ({page}) => {
  expect(await page.evaluate(async () => {
    const el = mount('<b>{{this.value}}</b>', {value:0});
    await Promise.resolve();
    let calls = 0; const refresh = el.refresh.bind(el);
    el.refresh = () => {calls++; refresh();};
    el.value = 1; el.requestRefresh(); el.value = 2; el.requestRefresh();
    const sync = el.shadowRoot.textContent;
    await Promise.resolve();
    const batched = [calls, el.shadowRoot.textContent];
    el.requestRefresh(); el.refresh(); await Promise.resolve();
    return [sync, batched, calls];
  })).toEqual(['0',[1,'2'],2]);
});

test('form properties reconcile DOM edits and boolean properties', async ({page}) => {
  expect(await page.evaluate(() => {
    const el = mount('<input [.value]="this.value"><input type="checkbox" [.checked]="this.checked"><button [.disabled]="this.disabled"></button><b [title]="this.caption">{{this.caption}}</b>', {value:'',checked:false,disabled:false,caption:'<b>safe</b>'});
    el.refresh(); const [input, checkbox] = el.shadowRoot.querySelectorAll('input');
    input.value = 'typed'; checkbox.checked = true; el.refresh();
    const safe = el.shadowRoot.querySelector('b').innerHTML;
    el.caption = null; el.refresh();
    return [input.value,checkbox.checked,el.shadowRoot.querySelector('button').disabled,safe,el.shadowRoot.querySelector('b').hasAttribute('title')];
  })).toEqual(['',false,false,'&lt;b&gt;safe&lt;/b&gt;',false]);
});

test('original demo renders and tic-tac-toe remains interactive', async ({page}) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('ttt-game').first().locator('button').first()).toBeVisible();
  await page.locator('ttt-game').first().locator('ttt-board button').first().click();
  await expect(page.locator('ttt-game').first().locator('.game-info')).toContainText('Next player: O');
  expect(errors).toEqual([]);
});

test('keyed reconciliation handles inserts, removals, permutations and fallback moves', async ({page}) => {
  expect(await page.evaluate(() => {
    const el = mount('<b>before</b><div fjs-for="this.rows" fjs-key="item.id">{{item.id}}</div><b>after</b>', {rows:[]});
    // Also exercise insertBefore in browsers without moveBefore.
    el.shadowRoot.moveBefore = undefined;
    let random = 123;
    const rnd = n => ((random = (Math.imul(random,1664525)+1013904223)>>>0) % n);
    for(let step=0;step<250;step++) {
      const before = new Map([...el.shadowRoot.querySelectorAll('div')].map(node=>[Number(node.textContent),node]));
      const ids = Array.from({length:rnd(30)},(_,i)=>i);
      for(let i=ids.length-1;i>0;i--) {const j=rnd(i+1);[ids[i],ids[j]]=[ids[j],ids[i]];}
      el.rows = ids.map(id=>({id})); el.refresh();
      const actual = [...el.shadowRoot.querySelectorAll('div')];
      if(actual.map(n=>Number(n.textContent)).join() !== ids.join()) return 'order at '+step;
      if(actual.some(node=>before.has(Number(node.textContent)) && before.get(Number(node.textContent))!==node)) return 'identity at '+step;
      if(el.shadowRoot.firstChild.textContent !== 'before' || el.shadowRoot.lastChild.textContent !== 'after') return 'sibling moved';
    }
    return 'ok';
  })).toBe('ok');
});

test('swapping distant keyed rows only moves the two affected nodes', async ({page}) => {
  expect(await page.evaluate(() => {
    const el = mount('<div fjs-for="this.rows" fjs-key="item.id">{{item.id}}</div>', {rows:Array.from({length:1000},(_,id)=>({id}))}); el.refresh();
    const observer = new MutationObserver(()=>{}); observer.observe(el.shadowRoot,{childList:true});
    [el.rows[1],el.rows[998]]=[el.rows[998],el.rows[1]];el.refresh();
    const moved = observer.takeRecords().reduce((n,r)=>n+r.addedNodes.length,0);
    return [moved,el.shadowRoot.children[1].textContent,el.shadowRoot.children[998].textContent];
  })).toEqual([2,'998','1']);
});

test('keyed child components keep local state and focused input during native moves', async ({page}) => {
  expect(await page.evaluate(async () => {
    const {freshElement} = await import('/fresh.js');
    let creations = 0;
    customElements.define('stateful-row',class extends freshElement {
      constructor() {super('<input><b>{{this.row.label}}</b>');this.token=++creations;}
    });
    const el=mount('<stateful-row fjs-for="row in this.rows" fjs-key="row.id" [.row]="row"></stateful-row>',{rows:[{id:1,label:'a'},{id:2,label:'b'},{id:3,label:'c'}]});
    el.refresh(); await Promise.resolve();
    const child=el.shadowRoot.children[0], input=child.shadowRoot.querySelector('input');
    input.value='draft'; input.focus();
    const hasMove=Boolean(el.shadowRoot.moveBefore);
    el.rows=[{id:3,label:'C'},{id:2,label:'B'},{id:1,label:'A'}];el.refresh();
    const result = [el.shadowRoot.children[2]===child,child.token,input.value,child.shadowRoot.querySelector('b').textContent,!hasMove || child.shadowRoot.activeElement===input];
    el.rows=[];el.refresh();
    return [...result,el.templateInstance.binders[0].keyedRows.size,el.templateInstance.binders[0].rows.length];
  })).toEqual([true,1,'draft','A',true,0,0]);
});

test('one element cannot silently combine conditional and loop directives', async ({page}) => {
  expect(await page.evaluate(async () => {
    const {freshElement}=await import('/fresh.js');
    class Invalid extends freshElement {constructor(){super('<i fjs-if="true" fjs-for="[]"></i>');}}
    customElements.define('invalid-directives',Invalid);
    try {new Invalid();return 'did not throw';} catch(error) {return error.message;}
  })).toBe('Put fjs-if and fjs-for on separate, nested elements.');
});
