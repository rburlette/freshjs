import {freshElement} from '/fresh.js';

// FreshJS components render in their own shadow DOM, where the page's stylesheets don't reach. So
// every component here adopts the shared Conduit theme and the icon classes itself. Each sheet is
// one shared object: the browser parses it once, however many components use it.
const theme = new CSSStyleSheet(), icons = new CSSStyleSheet();

export async function loadStyles() {
	theme.replaceSync(await (await fetch('/styles.css')).text());
	document.adoptedStyleSheets = [theme]; // the page itself uses the same copy, so it's downloaded once

	// icons come from a CDN and are optional; components pick them up whenever they arrive
	fetch('https://cdnjs.cloudflare.com/ajax/libs/ionicons/2.0.1/css/ionicons.min.css')
		.then(response => response.text())
		.then(css => icons.replaceSync(css))
		.catch(() => {});
}

// The base for every component in this app: the shared styles, plus helpers templates can call.
export class conduitElement extends freshElement {
	constructor(template) {
		super(template);
		this.shadowRoot.adoptedStyleSheets = [theme, icons];
	}

	avatar(image) {
		return image || '/default-avatar.svg';
	}

	formatDate(date) {
		return new Date(date).toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'});
	}
}
