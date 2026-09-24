import {freshElement} from '../../fresh.js';
import {createStore, reactive, useStore} from '../../fresh-state.js';

const counter = createStore({count: 0});
class Counter extends freshElement {
	constructor() {
		super(`<p>{{this.caption}}: {{this.state.count}} <button [.onclick]="() => this.state.count++">Increment</button></p>`);
		this.caption = 'Counter';
		this.state = useStore(this, counter);
	}
}
customElements.define('shared-counter', Counter);

class Demo extends freshElement {
	constructor() {
		super(`<h1>Shared state, no build step</h1>
<p>Either button updates both counters. Hide and restore the second counter to see it reconnect with the latest value.</p>
<shared-counter [.caption]="'First counter'"></shared-counter>
<div fjs-if="this.local.showSecond"><shared-counter [.caption]="'Second counter'"></shared-counter></div>
<button [.onclick]="() => { this.local.showSecond = !this.local.showSecond; }">Toggle second counter</button>
<button [.onclick]="() => { this.state.count = 0; }">Reset</button>
<p>Total: {{this.state.count}}</p>`);
		this.state = useStore(this, counter);
		this.local = reactive(this, {showSecond: true});
	}
}
customElements.define('shared-demo', Demo);
