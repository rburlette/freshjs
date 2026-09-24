# FreshJS

A small, dependency-free UI library built on native custom elements and ES modules.
Write HTML templates, change ordinary JavaScript fields, and call `refresh()`.
No npm installation, JSX compiler, bundler, or minification is needed to **use** it.

Templates are compiled once per custom-element tag and cloned for subsequent instances.
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
call `super.connectedCallback()`. Templates must be constant for each registered tag.
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
HTML lowercases attribute names, so property-binding names must be lowercase;
`[.textContent]` does **not** bind the camelCase `textContent` property. Prefer text
interpolation and lowercase custom component properties.

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
- Nested loops can use the outer item in the inner list expression, but inner row bindings
  only receive the inner item and inner `index`. They are not lexical JavaScript closures.
  Put additional scope on your data or pass it into a child component.

## Refresh and composition

`refresh()` is synchronous. Nothing proxies your state or rerenders automatically after
an event. Call it after changes, or call `requestRefresh()` to combine multiple requests
within the current turn into one microtask refresh. An explicit `refresh()` consumes
pending work. Microtask batching is not frame throttling or a promise-returning API.

Import/register child components **before constructing the parent**. Bind child properties
with `[.property]`; the parent refreshes registered FreshJS children after assigning them.
Late custom-element registration is not supported by the compiled parent bindings.
Each component should initialize its own state and provide sensible defaults for optional inputs.
For detached manual instances, call `refresh()` explicitly when ready.

## Template boundaries

Templates and expressions must be trusted application code. FreshJS uses `new Function`,
so it requires a Content Security Policy allowing `unsafe-eval`; it is not compatible with
strict no-eval CSP. Interpolated values are text, but dangerous property bindings such as
`innerHTML` and URL/event attributes are not sanitized. Never build template source from
untrusted input.

The interpolation parser uses the first `}}` to end an expression; it is not a full
JavaScript parser. Avoid literal `}}` inside expressions. Bindings in `<style>`, `<script>`,
comments, or nested `<template>` content are not processed. Shadow DOM isolates styles;
put component CSS in the template. The existing `context` object has no automatic scope
or parent propagation semantics.

## Examples

- `/todo-mvc/`: working todo example with editing, filtering, completion, deletion and
  best-effort localStorage persistence. It is inspired by TodoMVC, not a claim of passing
  the external TodoMVC conformance suite.
- `/`: original timecard, hero editor and tic-tac-toe demos. Some legacy timecard features
  remain unfinished; the todo and counter examples are the recommended starting points.

## Maintaining and benchmarking FreshJS

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
