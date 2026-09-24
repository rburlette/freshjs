import {freshElement} from '../fresh.js';
const storageKey = 'freshjs-todos';
const template = /*html*/`
<style>
  :host {display:block;max-width:36rem;margin:3rem auto;font:18px system-ui;color:#333}
  h1 {font-size:4rem;font-weight:200;text-align:center;margin:0 0 1rem}
  input,button {font:inherit} button {cursor:pointer}
  .new-todo {width:100%;box-sizing:border-box;padding:1rem}
  ul {list-style:none;padding:0} li {display:flex;align-items:center;gap:.7rem;padding:.7rem;border-bottom:1px solid #ddd}
  label {flex:1} .completed label {text-decoration:line-through;color:#888}
  .edit {flex:1;min-width:0} footer {display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;font-size:.85rem}
  [aria-pressed="true"] {font-weight:bold} .hint {font-size:.8rem;color:#666;text-align:center}
</style>
<h1>todos</h1>
<input class="new-todo" aria-label="New todo" placeholder="What needs to be done?"
  [.value]="this.newTodo" [.oninput]="e => { this.newTodo = e.target.value; }"
  [.onkeydown]="e => { if(e.key === 'Enter') this.add(); }">
<section fjs-if="this.todos.length > 0">
  <p><input id="toggle-all" type="checkbox" [.checked]="this.remaining === 0" [.onchange]="e => this.toggleAll(e.target.checked)"><label for="toggle-all">Toggle all</label></p>
  <ul>
    <li fjs-for="todo in this.visibleTodos" fjs-key="todo.id" [class]="todo.completed ? 'completed' : ''" [data-id]="todo.id">
      <input type="checkbox" aria-label="Complete todo" [.checked]="todo.completed" [.onchange]="e => { todo.completed = e.target.checked; this.save(); }">
      <label [.hidden]="this.editing === todo.id" [.ondblclick]="() => this.edit(todo)">{{todo.title}}</label>
      <input class="edit" aria-label="Edit todo" [.hidden]="this.editing !== todo.id"
        [.value]="this.editing === todo.id ? this.editText : todo.title"
        [.oninput]="e => { this.editText = e.target.value; }"
        [.onblur]="() => this.finishEdit(todo)" [.onkeydown]="e => this.editKey(e, todo)">
      <button aria-label="Delete todo" [.onclick]="() => this.remove(todo)">×</button>
    </li>
  </ul>
  <footer>
    <span>{{this.remaining}} {{this.remaining === 1 ? 'item' : 'items'}} left</span>
    <button [aria-pressed]="this.filter === 'all'" [.onclick]="() => this.setFilter('all')">All</button>
    <button [aria-pressed]="this.filter === 'active'" [.onclick]="() => this.setFilter('active')">Active</button>
    <button [aria-pressed]="this.filter === 'completed'" [.onclick]="() => this.setFilter('completed')">Completed</button>
    <button fjs-if="this.remaining < this.todos.length" [.onclick]="() => this.clearCompleted()">Clear completed</button>
  </footer>
</section>
<p class="hint">Double-click a todo to edit. Enter saves; Escape cancels.</p>`;
class TodoApp extends freshElement {
  constructor() {
    super(template);
    this.todos = [];
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if(Array.isArray(stored)) {
        const ids = new Set();
        this.todos = stored.filter(todo => {
          if(!todo || typeof todo.id !== 'number' || !Number.isSafeInteger(todo.id) || ids.has(todo.id) || typeof todo.title !== 'string' || typeof todo.completed !== 'boolean') return false;
          ids.add(todo.id); return true;
        });
      }
    } catch { /* Storage is optional; the example also works without it. */ }
    this.nextId = this.todos.reduce((max,todo)=>Math.max(max,todo.id),0) + 1;
    this.newTodo = '';
    this.filter = 'all';
    this.editing = null;
    this.editText = '';
  }
  get remaining() { return this.todos.filter(todo=>!todo.completed).length; }
  get visibleTodos() { return this.todos.filter(todo=>this.filter === 'all' || (this.filter === 'completed' ? todo.completed : !todo.completed)); }
  add() {
    const title = this.newTodo.trim();
    if(!title) return;
    this.todos.push({id:this.nextId++,title,completed:false});
    this.newTodo = ''; this.save();
  }
  remove(todo) { this.todos = this.todos.filter(item=>item !== todo); this.save(); }
  toggleAll(completed) { for(const todo of this.todos) todo.completed = completed; this.save(); }
  clearCompleted() { this.todos = this.todos.filter(todo=>!todo.completed); this.save(); }
  setFilter(filter) { this.filter = filter; this.refresh(); }
  edit(todo) {
    this.editing = todo.id; this.editText = todo.title; this.refresh();
    this.shadowRoot.querySelector(`li[data-id="${todo.id}"] .edit`).focus();
  }
  editKey(event,todo) {
    if(event.key === 'Escape') { this.editing = null; this.refresh(); }
    else if(event.key === 'Enter') this.finishEdit(todo);
  }
  finishEdit(todo) {
    if(this.editing !== todo.id) return;
    this.editing = null;
    const title = this.editText.trim();
    if(!title) this.remove(todo);
    else {todo.title = title; this.save();}
  }
  save() {
    try {localStorage.setItem(storageKey,JSON.stringify(this.todos));} catch { /* Optional persistence. */ }
    this.refresh();
  }
}
customElements.define('todo-app',TodoApp);
