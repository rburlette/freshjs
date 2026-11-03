// A small router for page URLs like /article/my-slug. Links in templates are ordinary
// <a href="..."> elements: clicks on them are caught here, so the page changes without reloading.

const patterns = [
	['/', 'home'], ['/tag/:tag', 'home'], ['/login', 'login'], ['/register', 'register'],
	['/settings', 'settings'], ['/editor', 'editor'], ['/editor/:slug', 'editor'], ['/article/:slug', 'article'],
	['/profile/:username', 'profile'], ['/profile/:username/favorites', 'favorites']
];

const listeners = new Set();

// The current page: {name, path, params, query}. A new object on every navigation.
export let route = match();

function match() {
	let path = location.pathname, query = new URLSearchParams(location.search);

	for(let [pattern, name] of patterns) {
		let keys = [], regex = new RegExp('^' + pattern.replace(/:(\w+)/g, (all, key) => { keys.push(key); return '([^/]+)'; }) + '/?$');
		let found = path.match(regex);
		if(found)
			return {name, path, query, params: Object.fromEntries(keys.map((key, i) => [key, decodeURIComponent(found[i + 1])]))};
	}

	return {name: 'not-found', path, query, params: {}};
}

export function navigate(url, {replace = false} = {}) {
	history[replace ? 'replaceState' : 'pushState'](null, '', url);
	if(!replace)
		window.scrollTo(0, 0);
	update();
}

export function onRouteChange(listener) {
	listeners.add(listener);
}

function update() {
	route = match();
	for(let listener of listeners)
		listener(route);
}

addEventListener('popstate', update);

// composedPath() sees into shadow DOM, so links inside components are found too
document.addEventListener('click', event => {
	let link = event.composedPath().find(node => node instanceof HTMLAnchorElement && node.hasAttribute('href'));

	if(!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
		link.target || link.origin !== location.origin)
		return;

	event.preventDefault();
	navigate(link.pathname + link.search);
});
