import {test, expect} from '@playwright/test';
test.beforeEach(async ({page}) => {
  await page.goto('/tests/');
  await page.evaluate(async () => {
    const {freshElement,html} = await import('/fresh.js');
    Object.assign(window,{freshElement,html});let count=0;
    window.mount=(template,state={})=>{
      const tag='feature-test-'+ ++count;
      customElements.define(tag,class extends freshElement {constructor(){super(template);Object.assign(this,state);}});
      const element=document.createElement(tag);document.body.append(element);return element;
    };
  });
});

test('nested loops preserve outer items and named indices in keyed event closures',async({page})=>{
  expect(await page.evaluate(()=>{
    const el=mount('<section fjs-for="(group, groupIndex) in this.groups" fjs-key="group.id"><button fjs-for="(row, rowIndex) in group.rows" fjs-key="row.id" [.onclick]="() => this.hits.push([group.id, groupIndex, row.id, rowIndex, index])">{{group.name}}:{{row.label}}</button></section>',{groups:[{id:1,name:'A',rows:[{id:10,label:'a'}]},{id:2,name:'B',rows:[{id:20,label:'b'}]}],hits:[]});el.refresh();
    el.groups.reverse();el.refresh();el.shadowRoot.querySelector('button').click();
    return [el.shadowRoot.querySelector('button').textContent,el.hits];
  })).toEqual(['B:b',[[2,0,20,0,0]]]);
});

test('property bindings accept explicit kebab-case names for camelCase properties',async({page})=>{
  expect(await page.evaluate(()=>{
    const el=mount('<b [.text-content]="this.caption"></b><input [.read-only]="true">',{caption:'working'});el.refresh();
    return [el.shadowRoot.querySelector('b').textContent,el.shadowRoot.querySelector('input').readOnly];
  })).toEqual(['working',true]);
});

test('late definitions receive latest parent props, including setters and constructor defaults',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  expect(await page.evaluate(async()=>{
    const el=mount('<late-row [.row-data]="this.data"></late-row>',{data:{name:'first'}});el.refresh();
    el.data={name:'latest'};
    class Late extends freshElement {
      rowData={name:'default'};
      constructor(){super('<b>{{this.rowData.name}}</b>');}
    }
    customElements.define('late-row',Late);
    await new Promise(resolve=>setTimeout(resolve,0));
    const child=el.shadowRoot.querySelector('late-row');
    el.data={name:'next'};el.refresh();
    const setterParent=mount('<late-setter [.data]="this.data"></late-setter>',{data:'assigned'});setterParent.refresh();
    customElements.define('late-setter',class extends freshElement {
      constructor(){super('<i>{{this._data}}</i>');}
      set data(value){this._data=value;this.assignments=(this.assignments||0)+1;}
    });
    await new Promise(resolve=>setTimeout(resolve,0));
    const setter=setterParent.shadowRoot.querySelector('late-setter');
    return [child.shadowRoot.textContent,setter.shadowRoot.textContent,setter.assignments,Object.hasOwn(setter,'data')];
  })).toEqual(['next','assigned',1,false]);
  expect(errors).toEqual([]);
});

test('template failures identify component, expression and binding',async({page})=>{
  const results=await page.evaluate(()=>{
    const errors=[];
    for(const template of ['<i>{{this.bad(}}</i>','<i>{{this.missing.value}}</i>','<i>{{unclosed</i>','<i fjs-for="this.rows"></i>']) {
      const tag='broken-test-'+errors.length;
      class Broken extends freshElement {constructor(){super(template);this.rows={};}}
      customElements.define(tag,Broken);
      try {new Broken().refresh();}catch(error){errors.push(error.message);}
    }
    return errors;
  });
  expect(results[0]).toContain('<broken-test-0> text {{this.bad(}}');
  expect(results[1]).toContain('this.missing.value');
  expect(results[2]).toContain('Unclosed');
  expect(results[3]).toContain('Expected an array');
});

test('reactive local and shared state batch refreshes, unsubscribe, and reconnect',async({page})=>{
  expect(await page.evaluate(async()=>{
    const {createStore,useStore,reactive}=await import('/fresh-state.js');
    const store=createStore({nested:{count:0},items:[]});
    class Counter extends freshElement {constructor(){super('<b>{{this.state.nested.count}}:{{this.state.items.length}}:{{this.local.flag}}</b>');this.state=useStore(this,store);this.local=reactive(this,{flag:false});}}
    customElements.define('shared-counter',Counter);
    const a=new Counter(),b=new Counter();document.body.append(a,b);await Promise.resolve();
    let calls=0;const original=a.refresh.bind(a);a.refresh=()=>{calls++;original();};
    store.state.nested.count++;store.state.nested.count++;store.state.items.push('x');a.local.flag=true;
    await Promise.resolve();const active=[a.shadowRoot.textContent,b.shadowRoot.textContent,calls];
    a.remove();store.state.nested.count=3;await Promise.resolve();const detachedCalls=calls;
    document.body.append(a);await Promise.resolve();
    return [active,detachedCalls,a.shadowRoot.textContent];
  })).toEqual([['2:1:true','2:1:false',1],1,'3:1:true']);
});

test('computed caches, watches batch, and disposed watches ignore pending work',async({page})=>{
  expect(await page.evaluate(async()=>{
    const {createStore,computed,watch}=await import('/fresh-state.js');
    const store=createStore({count:1});let evaluations=0;const seen=[];
    const double=computed(store,state=>{evaluations++;return state.count*2;});
    const initial=[double.value,double.value,evaluations];
    const stop=watch(store,s=>s.count,(value,old)=>seen.push([value,old]),{immediate:true});
    store.state.count=2;store.state.count=3;await Promise.resolve();
    const updated=[double.value,evaluations];
    store.state.count=4;stop();await Promise.resolve();double.dispose();
    return [initial,updated,seen];
  })).toEqual([[2,2,1],[6,2],[[1,undefined],[3,1]]]);
});

test('mount resources clean up once, resubscribe, and allow explicit disposal',async({page})=>{
  expect(await page.evaluate(()=>{
    const events=[];const el=mount('');el.remove();
    const setup=()=>{events.push('start');return()=>events.push('stop');};
    const stop=el.onMount(setup);el.onMount(setup);
    document.body.append(el);el.remove();document.body.append(el);stop();stop();el.remove();
    return events;
  })).toEqual(['start','start','stop','stop','start','start','stop','stop']);
});

test('callback templates support nested scopes, events, keys and mixed runtime children',async({page})=>{
  expect(await page.evaluate(async()=>{
    const {freshElement:Csp}=await import('/fresh-csp.js');
    customElements.define('callback-child',class extends Csp {constructor(){super(html`<b>${self=>self.message}</b>`);}});
    const template=html`<callback-child [.message]="${self=>self.caption}"></callback-child><button fjs-for="row in ${self=>self.rows}" fjs-key="${(_,scope)=>scope.row.id}" [.onclick]="${(self,{row,index})=>()=>self.hits.push([row.id,index])}">${(self,{row})=>self.caption+row.id}</button>`;
    const el=mount(template,{caption:'Hi',rows:[{id:1},{id:2}],hits:[]});el.refresh();el.rows.reverse();el.refresh();el.shadowRoot.querySelector('button').click();
    return [el.shadowRoot.querySelector('callback-child').shadowRoot.textContent,el.shadowRoot.querySelector('button').textContent,el.hits];
  })).toEqual(['Hi','Hi2',[[2,0]]]);
});

test('strict CSP demo renders and responds without eval or inline script permissions',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/examples/csp/');
  await expect(page.locator('csp-counter button')).toHaveText('Count: 0');
  await page.locator('csp-counter button').click();
  await expect(page.locator('csp-counter button')).toHaveText('Count: 1');
  await page.addScriptTag({url:'/tests/csp-probe.js'});
  expect(await page.evaluate(()=>window.cspBlocksEval)).toBe(true);
  expect(errors).toEqual([]);
});

test('onMount waits until a late-upgraded constructor has finished',async({page})=>{
  expect(await page.evaluate(async()=>{
    document.body.innerHTML='<late-mount></late-mount>';
    const seen=[];
    customElements.define('late-mount',class extends freshElement {
      constructor(){super('');this.onMount(()=>{seen.push(this.ready);});this.ready=true;}
    });
    await Promise.resolve();return seen;
  })).toEqual([true]);
});

test('store proxies preserve nested identity and notify for deletion and array edits',async({page})=>{
  expect(await page.evaluate(async()=>{
    const {createStore}=await import('/fresh-state.js');const store=createStore({items:[],nested:{value:1}});
    let count=0;const stop=store.subscribe(()=>count++);
    const same=store.state.nested===store.state.nested;
    store.state.nested.value=1;const unchanged=count;
    store.state.items.push('a');delete store.state.nested.value;
    const changed=count>0;stop();const before=count;store.state.items.pop();
    return [same,unchanged,changed,count===before];
  })).toEqual([true,0,true,true]);
});

test('numeric custom value properties are not treated as native text inputs',async({page})=>{
  expect(await page.evaluate(()=>{
    customElements.define('numeric-value',class extends freshElement {
      constructor(){super('');this.assignments=0;}
      set value(value){this._value=value;this.assignments++;}
      get value(){return this._value;}
    });
    const el=mount('<numeric-value [.value]="this.amount"></numeric-value>',{amount:2});el.refresh();el.refresh();
    return el.shadowRoot.firstChild.assignments;
  })).toBe(1);
});

test('stores accept opaque frozen values and isolate failing subscribers',async({page})=>{
  expect(await page.evaluate(async()=>{
    const {createStore}=await import('/fresh-state.js');
    const fixed=Object.freeze({nested:{value:1}});const store=createStore({fixed,count:0});
    const opaque=store.state.fixed===fixed;let called=false;
    store.subscribe(()=>{throw new Error('subscriber');});store.subscribe(()=>{called=true;});
    let error;try {store.state.count=1;}catch(e){error=e.message;}
    return [opaque,called,error,store.state.count];
  })).toEqual([true,true,'FreshJS store subscribers failed',1]);
});
