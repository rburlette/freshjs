// Optional reactive state. Rendering remains usable without this module.
export function createStore(initial) {
	const listeners = new Set(), proxies = new WeakMap(), raw = new WeakMap();
	const plain = value => value && (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
	const notify = () => {
		const errors = [];
		for(const listener of [...listeners]) {
			try { listener(); } catch(error) { errors.push(error); }
		}
		if(errors.length) throw new AggregateError(errors, 'FreshJS store subscribers failed');
	};
	const wrap = value => {
		if(!plain(value) || !Object.isExtensible(value)) return value;
		if(proxies.has(value)) return proxies.get(value);
		const proxy = new Proxy(value, {
			get(target, key, receiver) { return wrap(Reflect.get(target, key, receiver)); },
			set(target, key, value) {
				value = raw.get(value) || value;
				const changed = !Object.is(target[key], value) || !Object.hasOwn(target, key);
				const success = Reflect.set(target, key, value);
				if(success && changed) notify();
				return success;
			},
			deleteProperty(target, key) {
				const existed = Object.hasOwn(target, key), success = Reflect.deleteProperty(target, key);
				if(success && existed) notify();
				return success;
			}
		});
		proxies.set(value, proxy); raw.set(proxy, value); return proxy;
	};
	if(!plain(initial) || !Object.isExtensible(initial)) throw new TypeError('createStore requires an extensible plain object or array.');
	return {state: wrap(initial), subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }};
}

export function useStore(element, store) {
	element.onMount(() => store.subscribe(() => element.requestRefresh()));
	return store.state;
}

export function reactive(element, initial) { return useStore(element, createStore(initial)); }

export function computed(store, read) {
	let dirty = true, value;
	const dispose = store.subscribe(() => { dirty = true; });
	return {get value() { if(dirty) { value = read(store.state); dirty = false; } return value; }, dispose};
}

export function watch(store, read, callback, {immediate = false} = {}) {
	let value = read(store.state), pending = false, active = true;
	const stop = store.subscribe(() => {
		if(pending) return;
		pending = true;
		queueMicrotask(() => {
			pending = false;
			if(!active) return;
			const next = read(store.state);
			if(!Object.is(value, next)) { const previous = value; value = next; callback(next, previous); }
		});
	});
	if(immediate) {
		try { callback(value, undefined); }
		catch(error) { active = false; stop(); throw error; }
	}
	return () => { active = false; stop(); };
}
