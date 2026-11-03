// FreshJS: React-like components built on native web components.
// One file, no dependencies, no build step. Import freshElement and extend it.

const freshTemplates = new Map(); // tag name -> parsed template, shared by every instance of that tag
const rootScope = Object.freeze(Object.create(null)); // a component's own template has no loop variables

// The user can change these by typing or clicking, so in form fields they are compared with what
// the field shows, and only written when different. That keeps fields in sync with your data, and
// leaves a field alone while someone types (writing to it then can upset phone keyboards).
const userEditable = new Set(['value', 'checked', 'selected']);
const formFields = new Set(['input', 'textarea', 'select', 'option']);

// Bindings that load or navigate to a URL. A "javascript:" URL would run code, so it is blocked.
const urlNames = new Set(['href', 'src', 'action', 'formaction', 'xlink:href']);

function blockScriptUrl(name, value) {
	// browsers ignore control characters and spaces in a URL scheme, so strip them before checking
	if(urlNames.has(name) && /^javascript:/i.test(String(value).replace(/[\u0000-\u0020]/g, ''))) // eslint-disable-line no-control-regex
		return 'unsafe:' + value;

	return value;
}

// HTML lowercases attribute names, so [.text-content] is how you write the textContent property.
function camelCase(name) {
	return name.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
}

// Reads a template once per component type and records where each binding is, as a path of
// child indexes. Every instance is then a fast deep copy plus binders pointing into that copy.
class freshTemplate {
	constructor(rootNode, tagName, names) {
		this.rootNode = rootNode;
		this.tagName = tagName;
		this.names = names; // loop variables visible here, e.g. ['todo', 'index']
		this.factories = [];
		this.walk(rootNode, []);
	}

	walk(node, path) {
		if(node.nodeType === Node.TEXT_NODE) {
			this.bindText(node, path);
			return;
		}

		if(node.nodeType === Node.ELEMENT_NODE) {
			if(node.localName === 'style' || node.localName === 'script')
				return;

			if(node.hasAttribute('fjs-key') && !node.hasAttribute('fjs-for'))
				throw this.error('fjs-key only works on an element that also has fjs-for.');

			if(node.hasAttribute('fjs-if') || node.hasAttribute('fjs-for')) {
				this.bindChildTemplate(node, path);
				return;
			}
		}

		// children first, so a <select>'s <option>s exist before its value is set
		for(let i = 0; i < node.childNodes.length; i++)
			this.walk(node.childNodes[i], [...path, i]);

		if(node.nodeType === Node.ELEMENT_NODE)
			this.bindElement(node, path);
	}

	// "Hi {{this.name}}!" is split into three text nodes: "Hi ", the bound one, and "!".
	// Splitting adds the rest of the text as the next sibling, which the walk visits next.
	bindText(node, path) {
		let start = node.nodeValue.indexOf('{{'),
			end = node.nodeValue.indexOf('}}', start);

		if(start === -1 || end === -1)
			return;

		if(start > 0) {
			node.splitText(start);
			return;
		}

		if(end + 2 < node.nodeValue.length)
			node.splitText(end + 2);

		this.add(path, textBinder, node.nodeValue.slice(2, end));
		node.nodeValue = '';
	}

	// [name]="expression" sets an attribute, [.name]="expression" sets a property,
	// and (name)="expression" runs when the element fires that event
	bindElement(element, path) {
		for(let {name, value} of [...element.attributes]) {
			let isEvent = name[0] === '(' && name.endsWith(')');

			if(!isEvent && (name[0] !== '[' || !name.endsWith(']')))
				continue;

			element.removeAttribute(name);

			if(isEvent)
				this.add(path, eventBinder, value, {name: name.slice(1, -1)}, ['event']);
			else if(name[1] === '.')
				this.add(path, propertyBinder, value, {name: camelCase(name.slice(2, -1))});
			else if(name.startsWith('[on'))
				throw this.error(name + ' would turn a string into code. Use (' + name.slice(3, -1) + ')="..." for events.');
			else
				this.add(path, attributeBinder, value, {name: name.slice(1, -1)});
		}

		// child components refresh after their properties are set, so data flows top-down
		if(element.localName.includes('-'))
			this.add(path, componentBinder);
	}

	// fjs-if="expression" and fjs-for="item in expression" make their element a nested
	// template, and leave a comment in its place to mark where it goes.
	bindChildTemplate(element, path) {
		let loop = element.getAttribute('fjs-for');

		if(loop !== null && element.hasAttribute('fjs-if'))
			throw this.error('put fjs-if and fjs-for on separate elements, one inside the other.');

		element.replaceWith(document.createComment(loop === null ? 'fjs-if' : 'fjs-for'));

		if(loop === null) {
			let condition = element.getAttribute('fjs-if');
			element.removeAttribute('fjs-if');
			this.add(path, ifBinder, condition, {template: new freshTemplate(element, this.tagName, this.names)});
			return;
		}

		let keyExpression = element.getAttribute('fjs-key');
		element.removeAttribute('fjs-for');
		element.removeAttribute('fjs-key');

		let match = loop.match(/^\s*([\w$]+)\s+in\s+([\s\S]+)$/), // "todo in this.todos", or just "this.todos"
			itemName = match ? match[1] : 'item',
			names = [...new Set([...this.names, itemName, 'index'])], // inner loops still see outer variables
			template = new freshTemplate(element, this.tagName, names),
			key = keyExpression === null ? null : template.compile(keyExpression);

		this.add(path, forBinder, match ? match[2] : loop, {itemName, template, key, keyExpression});
	}

	add(path, binderClass, expression, options, params) {
		let evaluate = expression === undefined ? null : this.compile(expression, params);
		this.factories.push({path, binderClass, expression, evaluate, ...options});
	}

	// Expressions are plain JavaScript, compiled once per template. They run with `this` set to
	// the component, and loop variables passed in. Templates are code: never build them from user input.
	compile(expression, params = []) {
		try {
			return new Function('{' + this.names.join(',') + '}', ...params, 'return (' + expression + ');');
		} catch(error) {
			throw this.error('could not read "' + expression + '": ' + error.message);
		}
	}

	error(message) {
		return new Error('<' + this.tagName + '> ' + message);
	}

	createInstance(component) {
		return new freshTemplateInstance(this, component);
	}
}

// One rendered copy of a template, with a binder for each binding in it.
class freshTemplateInstance {
	constructor(template, component) {
		// importNode (unlike cloneNode) upgrades child components right away, so they can be refreshed
		this.element = document.importNode(template.rootNode, true);
		this.binders = template.factories.map(factory => {
			let node = this.element;
			for(let i of factory.path)
				node = node.childNodes[i];

			return new factory.binderClass(node, factory, component);
		});
	}

	refresh(scope) {
		for(let i = 0; i < this.binders.length; i++)
			this.binders[i].refresh(scope);
	}
}

// A binder keeps one spot in the DOM in sync with one expression, and only touches the DOM when the value changes.
class binder {
	constructor(node, factory, component) {
		this.node = node;
		this.factory = factory;
		this.component = component;
	}

	evaluate(scope, event, evaluate = this.factory.evaluate, expression = this.factory.expression) {
		try {
			return evaluate.call(this.component, scope, event);
		} catch(error) {
			throw new Error('<' + this.component.localName + '> error in "' + expression + '": ' + error.message, {cause: error});
		}
	}

	refresh(scope) {
		let value = this.evaluate(scope);

		if(this.hasChanged(value))
			this.update(value);

		this.oldValue = value;
	}

	hasChanged(value) {
		return value !== this.oldValue;
	}
}

class textBinder extends binder {
	update(value) {
		this.node.nodeValue = value ?? ''; // always text, never HTML
	}
}

class attributeBinder extends binder {
	update(value) {
		let name = this.factory.name;

		// boolean attributes like disabled and hidden are on when present, so false removes them;
		// aria-* attributes need the words "true" and "false", so they are left as they are
		if(typeof value === 'boolean' && !name.startsWith('aria-'))
			value = value ? '' : null;

		if(value == null)
			this.node.removeAttribute(name);
		else
			this.node.setAttribute(name, blockScriptUrl(name, value));
	}
}

class propertyBinder extends binder {
	constructor(node, factory, component) {
		super(node, factory, component);
		this.isUserEditable = userEditable.has(factory.name) && formFields.has(node.localName);
	}

	hasChanged(value) {
		// a function like "() => this.select(item)" is new on every refresh; rather than replace the
		// handler each time, point the wrapper already on the element at the newest one
		if(typeof value === 'function' && typeof this.oldValue === 'function') {
			this.handler = value;
			return false;
		}

		// compare with what the field shows, in the form the browser keeps it
		if(this.isUserEditable)
			return this.factory.name === 'value' ? this.node.value !== String(value ?? '') : this.node[this.factory.name] !== Boolean(value);

		return value !== this.oldValue;
	}

	update(value) {
		let name = this.factory.name;

		if(typeof value === 'function') {
			// one stable wrapper per binding: it calls the latest function with `this` as the component,
			// so a method like this.save works and list rows never call a stale item's function
			let binder = this;
			this.handler = value;
			value = function() { return binder.handler.apply(binder.component, arguments); };
		}

		this.node[name] = blockScriptUrl(name, value ?? null);
	}
}

// (click)="expression" runs the expression when the element fires that event, with the event
// available as `event`. If the expression is a function, such as this.save, it is called with the
// event. Then the component refreshes. It uses addEventListener, so it works for any event,
// including ones a child component sends with emit(), and returning false doesn't cancel the event.
class eventBinder extends binder {
	constructor(node, factory, component) {
		super(node, factory, component);
		this.scope = rootScope;

		node.addEventListener(factory.name, event => {
			let result = this.evaluate(this.scope, event);

			if(typeof result === 'function')
				result = result.call(component, event);

			refreshAfterEvent(component, result);
		});
	}

	// nothing on the page to update; just keep the row's loop variables for the next event
	refresh(scope) {
		this.scope = scope;
	}
}

class ifBinder extends binder {
	refresh(scope) {
		let show = Boolean(this.evaluate(scope));

		if(show) {
			this.instance = this.instance || this.factory.template.createInstance(this.component); // built when first shown
			this.instance.refresh(scope);
		}

		if(show && !this.shown)
			this.node.before(this.instance.element);
		else if(!show && this.shown)
			this.instance.element.remove();

		this.shown = show;
	}
}

class forBinder extends binder {
	constructor(node, factory, component) {
		super(node, factory, component);
		this.rows = []; // rows are kept and reused by position, so lists that grow again are cheap
		this.shownCount = 0;
	}

	refresh(scope) {
		let list = this.evaluate(scope) || []; // null or undefined (e.g. still loading) shows nothing

		if(this.factory.key) {
			this.refreshKeyed(list, scope);
			return;
		}

		for(let i = 0; i < list.length; i++) {
			let row = this.rows[i];

			if(!row) {
				row = this.rows[i] = this.factory.template.createInstance(this.component);
				row.scope = Object.create(scope); // the row can also see the loop variables around it
			}

			row.scope[this.factory.itemName] = list[i];
			row.scope.index = i;
			row.refresh(row.scope); // fill in the row before it goes on the page

			if(i >= this.shownCount)
				this.node.before(row.element);
		}

		for(let i = list.length; i < this.shownCount; i++)
			this.rows[i].element.remove();

		this.shownCount = list.length;
	}

	// With fjs-key, each row belongs to one item. Adding, removing or moving items adds, removes or
	// moves just those rows, so what is inside a row (focus, typed text, a child component's own
	// state) stays with its item.
	refreshKeyed(list, scope) {
		let itemName = this.factory.itemName,
			keyScope = this.keyScope = this.keyScope || Object.create(scope),
			oldRows = this.keyedRows || new Map(),
			rows = new Map(); // key -> row, in the new order

		// match every item to its row first, so a duplicate key fails before anything changes
		for(let i = 0; i < list.length; i++) {
			keyScope[itemName] = list[i];
			keyScope.index = i;
			let key = this.evaluate(keyScope, undefined, this.factory.key, this.factory.keyExpression);

			if(rows.has(key))
				throw new Error('<' + this.component.localName + '> fjs-key="' + this.factory.keyExpression + '" gave two items the same key: ' + String(key));

			let row = oldRows.get(key);
			if(!row) {
				row = this.factory.template.createInstance(this.component);
				row.scope = Object.create(scope);
			}

			row.scope[itemName] = list[i];
			row.scope.index = i;
			rows.set(key, row);
		}

		for(let [key, row] of oldRows)
			if(!rows.has(key))
				row.element.remove();

		// put the rows in order, moving only the ones that are out of place
		let cursor = [...oldRows.values()].find(row => row.element.parentNode)?.element || this.node;

		for(let row of rows.values()) {
			row.refresh(row.scope); // fill in the row before it goes on the page

			if(row.element === cursor) {
				cursor = cursor.nextSibling;
			} else if(cursor !== this.node && row.element === cursor.nextSibling) {
				// the row at the cursor belongs further down: take it out until its turn comes
				let outOfPlace = cursor;
				cursor = row.element.nextSibling;
				outOfPlace.remove();
			} else {
				cursor.before(row.element);
			}
		}

		this.keyedRows = rows;
	}
}

// After an event binding runs, the component that owns the template refreshes, so an event a child
// sends to its parent refreshes the parent. A handler that returns a promise (an async function)
// refreshes again when it resolves.
function refreshAfterEvent(component, result) {
	if(!component.refreshing) // events such as blur can fire while a refresh is changing the page
		component.refresh();

	if(result && typeof result.then === 'function')
		result.then(() => component.refresh());
}

// Refreshes a child component after its properties are set.
class componentBinder {
	constructor(node, factory, component) {
		this.node = node;
		node.freshParent = component; // the parent renders this child, so it doesn't render itself
	}

	refresh() {
		if(this.node instanceof freshElement) // false until the child's class is defined
			this.node.refresh();
	}
}

export class freshElement extends HTMLElement {
	constructor(templateString = '') {
		super();

		let template = freshTemplates.get(this.localName);

		if(!template) {
			let element = document.createElement('template');
			element.innerHTML = templateString;
			template = new freshTemplate(element.content, this.localName, []);
			template.source = templateString;
			freshTemplates.set(this.localName, template);
		} else if(template.source !== templateString) {
			// A template is compiled once and is code. If it changed per instance, data was probably
			// put in it with ${...}; that would be ignored here, and unsafe if the data came from a user.
			throw new Error('<' + this.localName + '> every instance must use the same template. Put changing values in {{ }} bindings, not in the template string.');
		}

		this.templateInstance = template.createInstance(this);
		this.attachShadow({mode: 'open'}).appendChild(this.templateInstance.element);
	}

	// A component renders when it is added to the page, unless it sits in another component's
	// template; then that parent renders it. If you override this, call super.connectedCallback().
	connectedCallback() {
		if(!this.freshParent)
			this.refresh();
	}

	// Re-evaluates every binding and updates only what changed. (event) bindings call it for you;
	// call it yourself after other changes, such as in a timer or a listener you added.
	refresh() {
		this.refreshing = true;
		try {
			this.templateInstance.refresh(rootScope);
		} finally {
			this.refreshing = false;
		}
	}

	// Sends an event that the parent can listen to with (name)="...". The value is in event.detail.
	emit(name, detail) {
		return this.dispatchEvent(new CustomEvent(name, {detail}));
	}

	// Refreshes the top-level component this one is inside, and everything in it. Use it when you
	// change data that components elsewhere on the page also show.
	refreshAll() {
		let top = this;
		while(top.freshParent)
			top = top.freshParent;

		top.refresh();
	}
}
