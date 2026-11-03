// FreshJS: React-like components built on native web components.
// One file, no dependencies, no build step. Import freshElement and extend it.

const freshTemplates = new Map(); // tag name -> parsed template, shared by every instance of that tag
const rootScope = Object.freeze(Object.create(null)); // a component's own template has no loop variables

// The user can change these by typing or clicking, so they are compared with what is on screen,
// not just with the last value written. This keeps inputs in sync with your data, like React.
const userEditable = new Set(['value', 'checked', 'selected']);

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

	// [name]="expression" sets an attribute, [.name]="expression" sets a property
	bindElement(element, path) {
		for(let {name, value} of [...element.attributes]) {
			if(name[0] !== '[' || name[name.length - 1] !== ']')
				continue;

			element.removeAttribute(name);

			if(name[1] === '.') {
				let property = camelCase(name.slice(2, -1));
				// [.onclick], [.on-delete] and other on... properties are event handlers: the component refreshes after them
				this.add(path, propertyBinder, value, {name: property, isEvent: property.startsWith('on')});
			}
			else if(name.startsWith('[on'))
				throw this.error(name + ' would turn a string into code. Use [.' + name.slice(1, -1) + ']="e => ..." for events.');
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

		element.removeAttribute('fjs-for');

		let match = loop.match(/^\s*([\w$]+)\s+in\s+([\s\S]+)$/), // "todo in this.todos", or just "this.todos"
			itemName = match ? match[1] : 'item',
			names = [...new Set([...this.names, itemName, 'index'])]; // inner loops still see outer variables

		this.add(path, forBinder, match ? match[2] : loop, {itemName, template: new freshTemplate(element, this.tagName, names)});
	}

	add(path, binderClass, expression, options) {
		let evaluate = expression === undefined ? null : this.compile(expression);
		this.factories.push({path, binderClass, expression, evaluate, ...options});
	}

	// Expressions are plain JavaScript, compiled once per template. They run with `this` set to
	// the component, and loop variables passed in. Templates are code: never build them from user input.
	compile(expression) {
		try {
			return new Function('{' + this.names.join(',') + '}', 'return (' + expression + ');');
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

	evaluate(scope) {
		try {
			return this.factory.evaluate.call(this.component, scope);
		} catch(error) {
			throw new Error('<' + this.component.localName + '> error in "' + this.factory.expression + '": ' + error.message, {cause: error});
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
	hasChanged(value) {
		// a function like "() => this.select(item)" is new on every refresh; rather than replace the
		// handler each time, point the wrapper already on the element at the newest one
		if(typeof value === 'function' && typeof this.oldValue === 'function') {
			this.handler = value;
			return false;
		}

		let name = this.factory.name;
		return value !== this.oldValue || (userEditable.has(name) && value !== this.node[name]);
	}

	update(value) {
		let name = this.factory.name;

		if(typeof value === 'function') {
			// one stable wrapper per binding: it calls the latest function with `this` as the component,
			// so [.onclick]="this.save" works and list rows never call a stale item's handler
			let binder = this;
			this.handler = value;
			value = function() {
				let result = binder.handler.apply(binder.component, arguments);

				if(binder.factory.isEvent)
					refreshAfterEvent(binder.component, result);

				return result;
			};
		}

		this.node[name] = blockScriptUrl(name, value ?? null);
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
}

// After an event handler from a template runs, the component that owns the template refreshes, so
// callbacks a parent passes down refresh the parent. A handler that returns a promise (an async
// function) refreshes again when it resolves.
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

	// Re-evaluates every binding and updates only what changed. Event handlers in templates call it
	// for you; call it yourself after other changes, such as in a timer or a listener you added.
	refresh() {
		this.refreshing = true;
		try {
			this.templateInstance.refresh(rootScope);
		} finally {
			this.refreshing = false;
		}
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
