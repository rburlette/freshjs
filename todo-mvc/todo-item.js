import {freshElement} from '../fresh.js';

const templateString = /*html*/`
<style>
	:host {
		display: block;
		padding: 12px 8px;
		font-size: 20px;
	}

	.view {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	label {
		flex: 1;
		word-break: break-word;
	}

	.completed {
		color: #999;
		text-decoration: line-through;
	}

	.edit {
		width: 100%;
		box-sizing: border-box;
		padding: 4px;
		font: inherit;
	}

	button {
		background: none;
		border: none;
		color: #b83f45;
		font: inherit;
		cursor: pointer;
	}
</style>
<div class="view" fjs-if="!this.editing">
	<input type="checkbox" aria-label="Complete" [.checked]="this.todo.completed" (change)="this.toggle(event.target.checked)">
	<label [class]="this.todo.completed && 'completed'" (dblclick)="this.startEditing()">{{this.todo.title}}</label>
	<button aria-label="Delete" (click)="this.emit('delete')">×</button>
</div>
<input class="edit" aria-label="Edit todo" fjs-if="this.editing"
	[.value]="this.editText"
	(input)="this.editText = event.target.value"
	(keydown)="this.handleKey(event)"
	(blur)="this.finishEditing()">
`;

// Shows one todo. The parent passes it in with [.todo], and hears about changes
// through the update and delete events this sends with emit().
class todoItem extends freshElement {
	constructor() {
		super(templateString);

		this.editing = false;
		this.editText = '';
	}

	toggle(completed) {
		this.todo.completed = completed;
		this.emit('update');
	}

	startEditing() {
		this.editing = true;
		this.editText = this.todo.title;
		this.refresh(); // refresh now, so the edit box exists before focusing it
		this.shadowRoot.querySelector('.edit').focus();
	}

	handleKey(event) {
		if(event.key === 'Enter') {
			this.finishEditing();
		} else if(event.key === 'Escape') {
			this.editing = false;
		}
	}

	finishEditing() {
		// blur fires too when Enter or Escape removes the input, so only finish once
		if(!this.editing)
			return;

		this.editing = false;

		let title = this.editText.trim();

		if(title) {
			this.todo.title = title;
			this.emit('update');
		} else {
			this.emit('delete');
		}
	}
}

customElements.define('todo-item', todoItem);
