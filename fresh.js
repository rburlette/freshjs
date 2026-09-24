const freshTemplates = Object.create(null);
const walkerNodeFilter = NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT;
const emptyArray = [];
const zeroWidthString = '\u200B';

class freshTemplate {
	constructor(rootNode, fieldName) {
		this.factories = [];
		this.nodeCounts = new Array(100);
		this.walkerDepth = -1;
		this.rootNode = rootNode;
		this.fieldName = fieldName;
		this.createFactories(rootNode);
	}

	makeNodeFunction() {
		for(var nodeEvalString = 'return rootNode', i = 0; i <= this.walkerDepth; i++)
			nodeEvalString += ('.childNodes[' + this.nodeCounts[i].count + ']');

		return new Function('rootNode', nodeEvalString + ';');
	}

	createFactories(currentNode) {
		let previousNode = currentNode,
			childFactories = [];

		let walker = document.createTreeWalker(
			currentNode,
			walkerNodeFilter,
			(node) => {
				if(node.parentNode === previousNode)
					this.nodeCounts[++this.walkerDepth] = {parent: node.parentNode, count: -1};
				else while(this.nodeCounts[this.walkerDepth].parent !== node.parentNode)
					this.walkerDepth--;

				previousNode = node;
				this.nodeCounts[this.walkerDepth].count++;

				if(node.nodeType === 3 || (node.nodeType === 1 && node.localName !== 'style' && node.localName != 'script'))
					return NodeFilter.FILTER_ACCEPT;

				return NodeFilter.FILTER_REJECT;
			},
			false);

		do {
			switch(currentNode.nodeType) {
				case 3:
					this.bindTextNode(currentNode);
					continue;
				case 1:
					if(currentNode.hasAttribute('fjs-if') && currentNode.hasAttribute('fjs-for'))
						throw new Error('Put fjs-if and fjs-for on separate, nested elements.');

					var factory =
						currentNode.hasAttribute('fjs-if') ? ifBinderFactory :
						currentNode.hasAttribute('fjs-for') ? forBinderFactory : null;

					if(factory) {
						childFactories.push(new factory(currentNode, this.makeNodeFunction(), this.fieldName));
						walker.currentNode = childFactories[childFactories.length - 1].placeholder;
						continue;
					}

					this.bindElement(currentNode);
					continue;
			}
		} while ((currentNode = walker.nextNode()) !== null);

		this.factories = [ ...childFactories, ...this.factories];
	}

	bindTextNode(node) {
		let start, end;
		while((start = node.nodeValue.indexOf('{{')) !== -1 && (end = node.nodeValue.indexOf('}}', start)) !== -1) {
			let lastOffset = node.nodeValue.length - (end + 2);
			let matchNode = start > 0 ? this.splitTextNode(node, start) : node;

			this.factories.push(new textBinderFactory(this.makeNodeFunction(), matchNode.nodeValue.substring(2, end - start), this.fieldName));

			node = lastOffset > 0 ? this.splitTextNode(matchNode, matchNode.nodeValue.length - lastOffset) : matchNode;
			matchNode.nodeValue = zeroWidthString;
		}
	}

	splitTextNode(node, offset) {
		this.nodeCounts[this.walkerDepth].count++;
		return node.splitText(offset);
	}

	bindElement(element) {
		// loop in reverse, so we can remove attributes while still looping
		for(let i = element.attributes.length - 1; i >= 0; i--) {
			let attrName = element.attributes[i].name;

			if(attrName[0] !== '[' || attrName[attrName.length - 1] !== ']')
				continue;

			let factoryClass = element.attributes[i].name[1] === '.' ? propertyBinderFactory : attributeBinderFactory;

			this.factories.push(new factoryClass(element.attributes[i], this.makeNodeFunction(), this.fieldName));
			element.removeAttribute(attrName);
		}

		if((customElements.get(element.localName) || Object).prototype instanceof freshElement)
			this.factories.push(new freshElementBinderFactory(this.makeNodeFunction()));
	}

	createInstance(thisArg) {
		return new freshTemplateInstance(document.importNode(this.rootNode, true), thisArg, this.factories);
	}
}

class freshElementBinderFactory {
	constructor(nodeFunction) {
		this.build = nodeFunction;
	}
}

class binderFactory {
	constructor(binderClass, nodeFunction, valueEvalString, fieldName, data) {
		this.binderClass = binderClass;
		this.nodeFunction = nodeFunction;
		this.valueFunction = new Function(fieldName || 'item', 'index', 'return (' + valueEvalString + ');');
		this.data = data;
	}

	build(rootNode, thisArg) {
		return new this.binderClass(this.nodeFunction(rootNode), this.valueFunction.bind(thisArg), thisArg, this.data);
	}
}

class textBinderFactory extends binderFactory {
	constructor(nodeFunction, valueEvalString, fieldName) {
		super(textBinder, nodeFunction, valueEvalString, fieldName);
	}
}

class propertyBinderFactory extends binderFactory {
	constructor(attribute, nodeFunction, fieldName) {
		super(propertyBinder, nodeFunction, attribute.value, fieldName, attribute.name.substring(2, attribute.name.length - 1));
	}
}

class attributeBinderFactory extends binderFactory {
	constructor(attribute, nodeFunction, fieldName) {
		super(attributeBinder, nodeFunction, attribute.value, fieldName, attribute.name.substring(1, attribute.name.length - 1));
	}
}

class childBinderFactory extends binderFactory {
	constructor(childBinderClass, element, nodeFunction, valueEvalString, fieldName, childFieldName, attributeName) {
		super(childBinderClass, nodeFunction, valueEvalString, fieldName);
		this.placeholder = element.parentNode.insertBefore(document.createComment(attributeName), element.nextSibling);
		element.remove();
		element.removeAttribute(attributeName);
		this.data = new freshTemplate(element, childFieldName);
	}
}

class ifBinderFactory extends childBinderFactory {
	constructor(element, nodeFunction, fieldName) {
		super(ifBinder, element, nodeFunction, element.getAttribute('fjs-if'), fieldName, fieldName, 'fjs-if');
	}
}

class forBinderFactory extends childBinderFactory {
	constructor(element, nodeFunction, fieldName) {
		const expression = element.getAttribute('fjs-for');
		const match = expression.match(/^\s*([A-Za-z_$][\w$]*)\s+in\s+([\s\S]+)$/);
		const itemName = match ? match[1] : 'item';
		const key = element.getAttribute('fjs-key');
		element.removeAttribute('fjs-key');
		super(forBinder, element, nodeFunction, match ? match[2] : expression, fieldName, itemName, 'fjs-for');
		if(key !== null)
			this.data.keyFunction = new Function(itemName, 'index', 'return (' + key + ');');
	}
}

class binder {
	constructor(node, valueFunction, defaultValue, thisArg, data) {
		this.node = node;
		this.valueFunction = valueFunction;
		this.defaultValue = defaultValue;
		this.thisArg = thisArg;
		this.data = data;
	}

	hasChanged(newValue) {
		return newValue !== this.oldValue;
	}

	refresh(item, index) {
		let newValue = this.valueFunction(item, index);

		if(newValue == null)
			newValue = this.defaultValue;

		if(this.hasChanged(newValue, item, index))
			this.update(newValue);

		this.oldValue = newValue;
	}
}

class propertyBinder extends binder {
	constructor(element, valueFunction, thisArg, propertyName) {
		super(element, valueFunction, null, thisArg, propertyName);
		this.propertyName = propertyName;
	}

	hasChanged(newValue) {
		// Form controls can change independently of the model between refreshes.
		return this.oldValue !== newValue ||
			(this.propertyName === 'value' && this.node.value !== String(newValue ?? '')) ||
			((this.propertyName === 'checked' || this.propertyName === 'selected') && this.node[this.propertyName] !== Boolean(newValue));
	}

	update(newValue) {
		this.node[this.propertyName] = newValue;
	}
}

class attributeBinder extends binder {
	constructor(element, valueFunction, thisArg, attributeName) {
		super(element, valueFunction, null, thisArg, attributeName);
	}

	update(newValue) {
		if(newValue == null)
			this.node.removeAttribute(this.data);
		else
			this.node.setAttribute(this.data, newValue);
	}
}

class textBinder extends binder {
	constructor(textNode, valueFunction, thisArg) {
		super(textNode, valueFunction, zeroWidthString, thisArg);
	}

	update(newValue) {
		this.node.nodeValue = newValue;
	}
}

class ifBinder extends binder {
	constructor(element, valueFunction, thisArg, template) {
		super(element, valueFunction, false, thisArg, template.createInstance(thisArg));
	}

	hasChanged(newValue, item, index) {
		if(newValue)
			this.data.refresh(item, index);

		return newValue !== this.oldValue;
	}

	update(newValue) {
		if(newValue)
			this.node.parentNode.insertBefore(this.data.element, this.node);
		else
			this.data.element.remove();
	}
}

class forBinder extends binder {
	constructor(element, valueFunction, thisArg, template) {
		super(element, valueFunction, emptyArray, thisArg, template);
		this.rows = [];
		if(template.keyFunction)
			this.keyedRows = new Map();
	}

	refresh(item, index) {
		const values = this.valueFunction(item, index) ?? emptyArray;
		if(this.keyedRows) {
			this.refreshKeyed(values);
			return;
		}

		for(let i = 0; i < values.length; i++) {
			let row = this.rows[i];
			if(!row) {
				row = this.rows[i] = this.data.createInstance(this.thisArg);
				row.refresh(values[i], i);
				this.node.parentNode.insertBefore(row.element, this.node);
			} else {
				row.refresh(values[i], i);
			}
		}

		for(let i = values.length; i < this.rows.length; i++)
			this.rows[i].element.remove();
		this.rows.length = values.length;
	}

	refreshKeyed(values) {
		const next = new Map();
		// Validate all keys before changing the DOM or the previous row map.
		for(let i = 0; i < values.length; i++) {
			const key = this.data.keyFunction.call(this.thisArg, values[i], i);
			if(next.has(key))
				throw new Error('Duplicate fjs-key: ' + String(key));
			next.set(key, null);
		}

		let i = 0;
		for(const key of next.keys()) {
			const row = this.keyedRows.get(key) || this.data.createInstance(this.thisArg);
			row.refresh(values[i], i++);
			next.set(key, row);
		}
		for(const [key, row] of this.keyedRows)
			if(!next.has(key)) row.element.remove();

		const rows = Array.from(next.values());
		const parent = this.node.parentNode;
		let head = this.rows.find(row => row.element.parentNode === parent)?.element || this.node;
		let tail = this.node.previousSibling;
		let start = 0, end = rows.length - 1;
		const move = (element, anchor) => {
			if(element.nextSibling === anchor && element.parentNode === parent) return;
			// Preserve focus and custom-element state when the browser supports it.
			if(parent.moveBefore && element.parentNode === parent)
				parent.moveBefore(element, anchor);
			else
				parent.insertBefore(element, anchor);
		};
		// Match both ends before moving nodes. Swapping two distant rows should
		// move those rows, not every row between them.
		while(start <= end) {
			const first = rows[start].element, last = rows[end].element;
			if(first === head) {
				head = head.nextSibling;
				start++;
			} else if(last === tail) {
				tail = tail.previousSibling;
				end--;
			} else if(last === head) {
				const nextHead = head.nextSibling;
				move(head, tail.nextSibling);
				head = nextHead;
				end--;
			} else if(first === tail) {
				const nextTail = tail.previousSibling;
				move(tail, head);
				tail = nextTail;
				start++;
			} else {
				move(first, head);
				start++;
			}
		}
		this.keyedRows = next;
		this.rows = rows;
	}
}

class freshTemplateInstance {
	constructor(element, thisArg, factories) {
		this.element = element;
		this.binders = new Array(factories.length);
		for(let i = 0; i < factories.length; i++)
			this.binders[i] = factories[i].build(element, thisArg);
	}

	refresh(item, index) {
		for(let i = 0; i < this.binders.length; i++)
			this.binders[i].refresh(item, index);
	}
}

export class freshElement extends HTMLElement {
	constructor(templateString) {
		super();

		if(!freshTemplates[this.localName]) {
			const template = document.createElement('template');
			template.innerHTML = templateString || '';
			freshTemplates[this.localName] = new freshTemplate(template.content);
		}

		this.templateInstance = freshTemplates[this.localName].createInstance(this);
		this.attachShadow({mode: 'open'}).appendChild(this.templateInstance.element);
		this.context = {};
	}

	connectedCallback() {
		// Wait for subclass fields and parent property bindings to be initialized.
		this.requestRefresh();
	}

	requestRefresh() {
		if(!this.refreshPending) {
			this.refreshPending = true;
			queueMicrotask(() => {
				if(this.refreshPending) this.refresh();
			});
		}
	}

	refresh() {
		this.refreshPending = false;
		this.templateInstance.refresh();
	}
}
