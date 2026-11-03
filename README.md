# [FreshJS](https://github.com/rburlette/freshjs)

FreshJS is a web component based JavaScript library modeled after React for building user interfaces. It is a single file with no dependencies, and there is nothing to install or compile.

* **Inspiration:** FreshJS was inspired by the hundreds of megabytes of npm packages that are required to start a simple React or Angular project. My goal was to make a very small library relying on web standards and that does not require minification or compilation of JSX.
* **Component-Based:** Similar to React, you can build composable components with state and properties.
* **High-Performance:** Component templates are only processed the first time an element is loaded, and for each individual instance of the element the DOM is quickly cloned afterward. FreshJS avoids searching the DOM to find element references for each template instance, and a refresh only touches the DOM where a value changed.

## Installation

Copy `fresh.js` into your project and import it. It works in any browser that supports web components and JavaScript modules. Browsers only load modules over HTTP, so serve your files with any static web server rather than opening them directly.

## Example

```js
import {freshElement} from './fresh.js';

const templateString = /*html*/`
<h2>{{this.heroInfo.name.toUpperCase()}} Details</h2>
<div><span>id: </span>{{this.heroInfo.Id}}</div>
<div>
  <label>name:
    <input [.value]="this.heroInfo.name" (input)="this.onNameChange(event.target.value)" placeholder="name">
  </label>
  <span fjs-if="this.heroInfo.name == 'bob'">testing</span>
</div>`;

class hero extends freshElement {
    constructor() {
        super(templateString);

        this.heroInfo = {
            name: 'Windstorm',
            Id: 1
        };
    }

    onNameChange(value) {
        this.heroInfo.name = value;
    }
}

customElements.define('fjs-hero', hero);
```

This example recreates the Hero Editor component in the Angular tutorial. Put `<fjs-hero></fjs-hero>` on a page and it renders itself. When you type, `(input)` changes the name and the component refreshes by itself.

## Templates

| Syntax | What it does |
| --- | --- |
| `{{this.name}}` | Inserts text. It is always text, never HTML. |
| `[title]="this.tip"` | Sets an attribute. `null`, `undefined` and `false` remove it, and `true` adds it with no value, so `[disabled]="this.busy"` works. |
| `[.value]="this.name"` | Sets a DOM property. |
| `(click)="this.save()"` | Runs when the element fires the event, then refreshes the component. `event` is the event: `(input)="this.name = event.target.value"`. If the expression is a function, such as `(click)="this.save"`, it is called with the event. |
| `fjs-if="this.visible"` | Adds or removes the element. |
| `fjs-for="todo in this.todos"` | Repeats the element for each item. `index` is the item's position. Without a name, the item is called `item`. |

Square brackets put data into an element, and round brackets get events out of it. Expressions are plain JavaScript, and `this` is the component. Inner loops can use the outer loop's item name, and `index` is always the innermost loop's position.

HTML lowercases attribute names, so write camelCase properties with dashes: `[.text-content]` sets `textContent`. For the same reason, name your own events in lowercase or with dashes, such as `(square-click)`.

## Refreshing

* After an `(event)` binding runs, the component whose template it is in refreshes. If the expression returns a promise, as an `async` method does, it refreshes again when the promise resolves.
* When a child sends an event with `this.emit('delete')`, the parent's `(delete)="..."` binding is in the parent's template, so the parent refreshes.
* Refreshing a component refreshes the child components in its template too, after their properties are set. Only values that changed touch the page.
* Call `this.refresh()` yourself after other changes: in a timer, in a listener you added with `addEventListener`, after a promise you didn't return, or when the page has to update in the middle of a handler (for example, to focus an input you just showed).
* Call `this.refreshAll()` when you change data that components elsewhere on the page also show. It refreshes the top-level component this one is inside, and everything in it.

## Components

* Pass data to child components with properties, and listen for the events they send: `<todo-item [.todo]="todo" (delete)="this.deleteTodo(todo)"></todo-item>`.
* A child sends an event with `this.emit('delete')`, or `this.emit('delete', value)` to include a value, which the parent reads as `event.detail`. It is an ordinary DOM event, so components that aren't built with FreshJS can listen too.
* Template expressions can use `this` and global names, but not the imports in your module. To use an imported function, call it from a component method.
* Import a child component at the top of the parent's file, so it is defined before the parent uses it.
* Lists reuse rows by position. When the list changes, a row's elements show the new item that is now at that position.
* The usual web component lifecycle callbacks work. If you override `connectedCallback`, call `super.connectedCallback()`.
* Don't give component fields or methods the same names as built-in element properties such as `title`, `id`, `hidden` or `remove`.
* Each component type has one template string, and FreshJS reports an error if it changes between instances.

## Security

* `{{ }}` always inserts text, so user data can't add HTML or scripts to the page.
* Bound `javascript:` URLs in `href`, `src`, `action` and `formaction` are blocked.
* Attribute bindings for events like `[onclick]` are refused, because they turn strings into code. Use `(click)` instead.
* Templates are code. Never build a template string from user input. Use `{{ }}` bindings for data instead of `${ }`.
* `[.inner-html]` inserts raw HTML. Only use it with HTML you trust or have sanitized.
* Expressions are compiled with `new Function`, so a Content Security Policy must allow `'unsafe-eval'`.

## Examples and tests

To try them, serve the repository folder with any static web server and open it in your browser. For example:

* Python: run `python3 -m http.server` in the folder, then open http://localhost:8000/
* Node: run `npx http-server` in the folder, then open http://localhost:8080/
* VS Code: open the folder and use the Live Server extension

What's included:

* `index.html`: the timecard, tic-tac-toe and hero editor demos. The timecard is built from nested components (`ch-timecard` shows a `ch-timecard-day` for each day, which shows a `ch-timecard-shift` for each shift), with its rules as plain functions in `timecard-model.js`.
* `todo-mvc/`: a todo app with a child component, editing, filters and saving to localStorage.
* `test.html`: open it in a browser to run the tests.

## License

FreshJS is released under the [MIT License](LICENSE).
