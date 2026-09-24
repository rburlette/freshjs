import {freshElement, html} from '../../fresh-csp.js';
import {reactive} from '../../fresh-state.js';
const template = html`<button [.onclick]="${self => () => self.state.count++}">Count: ${self => self.state.count}</button>`;
class Counter extends freshElement {
	constructor() { super(template); this.state = reactive(this, {count: 0}); }
}
customElements.define('csp-counter', Counter);
