import {freshElement} from '../../fresh.js';
import './todo-item.js';

const storageKey = 'freshjs-todos';

const templateString = /*html*/`
<style>
	:host {
		display: block;
		max-width: 550px;
		margin: 40px auto;
		font: 16px sans-serif;
		color: #333;
	}

	h1 {
		margin: 0 0 16px;
		text-align: center;
		font-size: 64px;
		font-weight: 200;
		color: #b83f45;
	}

	.new-todo {
		width: 100%;
		box-sizing: border-box;
		padding: 12px;
		font: inherit;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		border-bottom: 1px solid #ededed;
	}

	footer {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 0;
		font-size: 14px;
	}

	.count {
		flex: 1;
	}

	a {
		padding: 2px 6px;
		border: 1px solid transparent;
		color: inherit;
		text-decoration: none;
	}

	a.selected {
		border-color: #e0b0b0;
		border-radius: 3px;
	}

	button {
		background: none;
		border: none;
		font: inherit;
		cursor: pointer;
	}
</style>
<h1>todos</h1>
<input class="new-todo" aria-label="New todo" placeholder="What needs to be done?" autofocus
	[.value]="this.newTitle"
	(input)="this.newTitle = event.target.value"
	(keydown)="event.key === 'Enter' && this.addTodo()">
<section fjs-if="this.todos.length > 0">
	<label>
		<input type="checkbox" [.checked]="this.activeCount === 0" (change)="this.toggleAll(event.target.checked)">
		Mark all as complete
	</label>
	<ul>
		<li fjs-for="todo in this.shownTodos" fjs-key="todo">
			<todo-item [.todo]="todo" (update)="this.save()" (delete)="this.deleteTodo(todo)"></todo-item>
		</li>
	</ul>
	<footer>
		<span class="count">{{this.activeCount}} {{this.activeCount === 1 ? 'item' : 'items'}} left</span>
		<a href="#/" [class]="this.filter === 'all' && 'selected'">All</a>
		<a href="#/active" [class]="this.filter === 'active' && 'selected'">Active</a>
		<a href="#/completed" [class]="this.filter === 'completed' && 'selected'">Completed</a>
		<button fjs-if="this.activeCount < this.todos.length" (click)="this.clearCompleted()">Clear completed</button>
	</footer>
</section>
`;

class todoApp extends freshElement {
	constructor() {
		super(templateString);

		this.todos = JSON.parse(localStorage.getItem(storageKey)) || [];
		this.newTitle = '';
		this.onHashChange = () => this.refresh(); // a window listener, not a template event, so it refreshes itself
	}

	// normal web component lifecycle callbacks work; just call super.connectedCallback()
	connectedCallback() {
		window.addEventListener('hashchange', this.onHashChange);
		super.connectedCallback();
	}

	disconnectedCallback() {
		window.removeEventListener('hashchange', this.onHashChange);
	}

	get filter() {
		return location.hash.slice(2) || 'all';
	}

	get activeCount() {
		return this.todos.filter(todo => !todo.completed).length;
	}

	get shownTodos() {
		if(this.filter === 'all')
			return this.todos;

		return this.todos.filter(todo => todo.completed === (this.filter === 'completed'));
	}

	addTodo() {
		let title = this.newTitle.trim();

		if(!title)
			return;

		this.todos.push({title, completed: false});
		this.newTitle = '';
		this.save();
	}

	deleteTodo(todo) {
		this.todos = this.todos.filter(other => other !== todo);
		this.save();
	}

	toggleAll(completed) {
		for(let todo of this.todos)
			todo.completed = completed;

		this.save();
	}

	clearCompleted() {
		this.todos = this.todos.filter(todo => !todo.completed);
		this.save();
	}

	save() {
		localStorage.setItem(storageKey, JSON.stringify(this.todos));
	}
}

customElements.define('todo-app', todoApp);
