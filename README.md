# FreshJS

A small, dependency-free UI library built on native custom elements and ES modules.
Write HTML templates and use explicit refreshes or opt-in reactive state.
No npm installation, JSX compiler, bundler, or minification is needed to **use** it.

Templates are processed once per component class and cloned for subsequent instances.
Bindings update DOM nodes directly. Components use an open shadow root.

## Start with one HTML file

Copy `fresh.js` beside this file and serve the directory with any static web server.
ES modules need HTTP(S); double-clicking a `file://` page is not supported by browsers.

```html
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>FreshJS counter</title>
<my-counter></my-counter>
<script type="module">
  import {freshElement} from './fresh.js';

  class Counter extends freshElement {
    constructor() {
      super(`<button [.onclick]="() => this.increment()">Count: {{this.count}}</button>`);
      this.count = 0;
    }
    increment() {
      this.count++;
      this.refresh();
    }
  }
  customElements.define('my-counter', Counter);
</script>
</html>
```

Connecting a component schedules its first render in a microtask, after constructor
fields and parent bindings have been assigned. If you override `connectedCallback()`,
call `super.connectedCallback()`. If you override `disconnectedCallback()`, call its
super method too so subscriptions and resources are released. Templates must be constant
for each component class.
Avoid component field names that collide with native HTMLElement properties (such as
`title`, `id`, or `hidden`); writing those in a constructor may violate custom-element
construction rules. Use names such as `caption` or `selectedId` instead.

## Bindings

| Syntax | Meaning |
| --- | --- |
| `{{this.message}}` | Text, safely inserted as text rather than HTML |
| `[title]="this.message"` | HTML attribute; `null`/`undefined` removes it |
| `[.value]="this.name"` | DOM property |
| `[.checked]="this.done"` | Boolean DOM property |
| `[.onclick]="() => this.save()"` | Event handler property |
| `fjs-if="this.visible"` | Attach or detach an element and its subtree |
| `fjs-for="row in this.rows"` | Repeat an element, reusing rows by position |
| `fjs-key="row.id"` | On an `fjs-for` element, reuse rows by stable unique key |

Expressions are ordinary JavaScript. `this` is the owning component. A loop exposes
its item name (default `item`) and zero-based `index`. Event arrows capture the
current item/index on each refresh; handlers can be replaced or cleared with `null`.
A bare method reference keeps normal DOM event `this` behavior, so use an arrow or
bind the method if it needs the component as `this`.

Use `[.disabled]="this.busy"`, not `[disabled]="this.busy"`: HTML boolean attributes
are enabled by their presence, including the string `"false"`. Ordinary attributes
stringify values, which is appropriate for `aria-pressed="false"`.
HTML lowercases attribute names. Use explicit kebab-case for camelCase properties:
`[.text-content]` binds `textContent`, `[.read-only]` binds `readOnly`, and
`[.row-data]` binds a custom `rowData` property. Existing lowercase bindings still work.
Writing `[.textContent]` directly is unreliable because HTML erases the capitalization.

## Lists and conditions

```html
<ul>
  <li fjs-for="todo in this.todos" fjs-key="todo.id">
    <input type="checkbox" [.checked]="todo.done"
      [.onchange]="e => { todo.done = e.target.checked; this.refresh(); }">
    {{index + 1}}. {{todo.title}}
    <button [.onclick]="() => this.remove(todo.id)">Delete</button>
    <span fjs-if="todo.done">Complete</span>
  </li>
</ul>
```

- Use keys for lists that reorder or have input/custom-element state. A surviving key
  keeps its DOM node and child component even when the item object is replaced.
  Keys use `Map` equality and must be unique; duplicate keys throw before list DOM changes.
  Avoid indices as keys when items can move. Browser `moveBefore()` preserves focus
  during moves where available; older browsers fall back to `insertBefore()`, which
  preserves node identity but can lose focus and trigger reconnect callbacks.
- Without `fjs-key`, rows are reused by index. This is smaller in allocation cost and
  useful for fixed-position displays; local DOM state stays with the position.
- `null` and `undefined` lists mean empty. Use arrays; general iterables are not supported.
  Removed rows are released, rather than retained at the largest historical list size.
- Put `fjs-if` and `fjs-for` on separate nested elements. Combining them on one element
  throws a descriptive error. A false `fjs-if` retains its detached instance/state for reuse.
- Nested loops inherit outer item names. Use `fjs-for="(group, groupIndex) in this.groups"`
  and an inner `fjs-for="(row, rowIndex) in group.rows"`; inner bindings can read `group`,
  `groupIndex`, `row`, and `rowIndex`. `index` always means the innermost index. Reusing an
  alias shadows the outer name; item and index aliases must differ and be valid JS names.
  `index` is reserved for the innermost index; do not use it as an item alias.
- A non-array list, a key without a loop, an unclosed interpolation, or a failing binding
  produces an error. Expression errors identify the owning component and template location
  and preserve the original exception as `cause`.

## Refresh and composition

`refresh()` is synchronous. Ordinary fields remain explicit; the optional reactive module
below adds automatic updates. Call `refresh()` after ordinary field changes, or
`requestRefresh()` to combine multiple requests
within the current turn into one microtask refresh. An explicit `refresh()` consumes
pending work. Microtask batching is not frame throttling or a promise-returning API.

Bind child properties with `[.property]`; the parent refreshes FreshJS children after
assigning their inputs. Children may register later: property assignment waits until
registration, then the latest parent values are applied before rendering. This also avoids
creating own properties that would shadow a late-upgraded custom-element setter.
Registering before construction is still the simplest way to avoid a temporarily empty child.
Each component should initialize its own state and provide sensible defaults for optional inputs.
For detached manual instances, call `refresh()` explicitly when ready.

## Optional automatic updates and shared state

Copy `fresh-state.js` too when you want automatic updates. It has no imports or dependencies.
It is never loaded by the core runtime unless your application imports it.

```js
import {freshElement} from './fresh.js';
import {reactive} from './fresh-state.js';

class Counter extends freshElement {
  constructor() {
    super(`<button [.onclick]="() => this.state.count++">{{this.state.count}}</button>`);
    this.state = reactive(this, {count: 0});
  }
}
customElements.define('auto-counter', Counter);
```

Changes through `this.state`, including nested object assignments, deletes, and array
methods, schedule one component refresh per microtask. Keep the returned proxy; writes
through the original raw object cannot be observed. This is store-level notification,
not per-binding dependency tracking: all connected components subscribed to a changed
store refresh. Plain fields outside the proxy still require an explicit refresh.

For shared state, create a store in a module and attach each interested component:

```js
import {createStore, useStore, computed, watch} from './fresh-state.js';

const cart = createStore({items: []});
// Inside each component constructor:
// this.cart = useStore(this, cart);

const total = computed(cart, state => state.items.reduce((sum, item) => sum + item.price, 0));
const stop = watch(cart, state => state.items.length, (count, previous) => {
  console.log('Cart size changed:', previous, '→', count);
});
cart.state.items.push({price: 5});
console.log(total.value); // 5; recomputes lazily after store changes
// At the end of this observer's lifetime:
// stop();
// total.dispose();
```

`computed(store, read)` caches until any mutation in that store. `watch(store, read,
callback, {immediate: true})` optionally calls back immediately; subsequent calls are
batched in a microtask and compare the selected value using `Object.is`. Select a scalar
when watching changes inside an object: selecting the object itself does not notice
in-place changes to its identity. The returned stop function also cancels queued callbacks.
Standalone computed values and watchers must be disposed by their owner.

Stores deeply wrap extensible plain objects and arrays. Dates, Maps, Sets, DOM nodes,
class instances, and frozen/sealed objects are opaque: replace their containing property
to notify observers. The store root must be an extensible plain object or array.
`Object.defineProperty` and raw-object writes are not observed. Use normal assignments,
array methods, and `delete`; replace properties on `store.state`, not `store.state` itself.

## Mount resources and cleanup

`onMount(setup)` calls a synchronous `setup` after construction when connected. Start
async work inside that function (for example, with an AbortController). A setup may return a
cleanup function. Cleanup runs on disconnect; setup runs again on reconnect. The returned
stop function removes that resource registration and cleans it up if active.

```js
// Inside a component using reactive state:
this.onMount(() => {
  const timer = setInterval(() => { this.state.now = Date.now(); }, 1000);
  return () => clearInterval(timer);
});
```

Use the same pattern for event listeners, subscriptions, watchers, and AbortControllers.
`reactive()` and `useStore()` use it automatically, so disconnected components do not stay
subscribed; reconnecting renders the latest state. Native state-preserving DOM moves keep
resources active where supported; the older insertion fallback disconnects/reconnects them.
Cleanup errors are collected so one failure does not prevent other resources being released.

## No-eval CSP templates

Choose **one** standalone renderer: `fresh.js` for string expressions, or `fresh-csp.js`
for JavaScript callbacks. Both are ready to copy and import without application build tools.
The optional `fresh-state.js` works with either. A component from either entry point can
also be nested inside a component from the other.

```js
import {freshElement, html} from './fresh-csp.js';
import {reactive} from './fresh-state.js';

// Define reusable templates outside constructors. Each callback receives the current
// component and its loop scope; do not capture one component instance in the template.
const template = html`
  <button [.onclick]="${self => () => self.state.count++}">
    Count: ${self => self.state.count}
  </button>`;

class Counter extends freshElement {
  constructor() {
    super(template);
    this.state = reactive(this, {count: 0});
  }
}
customElements.define('safe-counter', Counter);
```

Every `${...}` substitution must be a function, evaluated as `(component, scope) => value`.
Event bindings return an event handler, e.g. `${self => event => self.handle(event)}`.
Keep substitutions in text or in quoted binding attribute values, not tag/attribute names,
comments, styles, or scripts. Ordinary static attributes are not dynamic bindings.

```js
const rows = html`
  <button fjs-for="(row, rowIndex) in ${self => self.rows}"
    fjs-key="${(_, {row}) => row.id}"
    [.onclick]="${(self, {row}) => () => self.select(row.id)}">
    ${(_, {row, rowIndex}) => `${rowIndex + 1}. ${row.label}`}
  </button>`;
```

`fresh-csp.js` never uses eval/string-to-code compilation, including DOM-node lookups.
It rejects string expressions instead of silently compiling them. Serve your own script
files under a policy such as `script-src 'self'`; no `unsafe-eval` or inline scripts are
needed. `/examples/csp/` is a runnable counter with an enforcing CSP. CSS still follows
your policy, and enforced Trusted Types requires separate integration. The familiar
string `{{expression}}` syntax in `fresh.js` remains available when your policy allows it.

## Template boundaries

Templates and callbacks must be trusted application code. The string-expression entry
point uses `new Function` and requires `unsafe-eval`; choose `fresh-csp.js` for no-eval
policies. Interpolated values are text, but dangerous property bindings such as
`[.inner-html]` and URL/event attributes are not sanitized. Never build template source from
untrusted input.

The interpolation parser uses the first `}}` to end an expression; it is not a full
JavaScript parser. Avoid literal `}}` inside string expressions; use callback templates
for complex JavaScript. Null text now renders an empty string, without an invisible
zero-width placeholder. Multiple interpolations in one source text node share a binding. Bindings in `<style>`, `<script>`,
comments, or nested `<template>` content are not processed. Shadow DOM isolates styles;
put component CSS in the template. The existing `context` object has no automatic scope
or parent propagation semantics.

## Examples

- `/examples/shared/`: two counters sharing reactive state with disconnect/reconnect.
- `/examples/csp/`: a counter using reactive state and no-eval callback templates.
- `/todo-mvc/`: working todo example with editing, filtering, completion, deletion and
  best-effort localStorage persistence. It is inspired by TodoMVC, not a claim of passing
  the external TodoMVC conformance suite.
- `/`: original timecard, hero editor and tic-tac-toe demos. Some legacy timecard features
  remain unfinished; the todo and counter examples are the recommended starting points.

## Maintaining and benchmarking FreshJS

Applications import the committed standalone files and need no build. For library
maintenance, edit `src/fresh-core.js` and run `npm run build` to regenerate `fresh.js` and
`fresh-csp.js`; the small packaging script uses only Node built-ins. Edit `fresh-state.js`
directly. CI checks that generated entry points match their source.

These optional developer dependencies are used only for tests and measurements:

```sh
npm ci
npx playwright install chromium
npm test
npm run size
npm run benchmark
```

`npm test` runs Chromium by default. Install the other browsers and use `npm run test:all`
for Firefox and WebKit too. `npm run serve` provides an optional local server on port 8080.
See [benchmarks/README.md](benchmarks/README.md) for comparison methodology, raw results,
and exporting an implementation to the standard `js-framework-benchmark` suite.
