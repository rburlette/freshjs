import {freshElement} from '/fresh.js';

const dateFormat = new Intl.DateTimeFormat('en-US', {month: 'long', day: 'numeric', year: 'numeric'});

// The base for every component in this app. They render in the page, so the theme in index.html
// styles them like any other HTML, and templates can call these helpers.
export class conduitElement extends freshElement {
	static shadow = false;

	avatar(image) {
		return image || '/default-avatar.svg';
	}

	// templates run their expressions on every refresh, so the formatter is made once, not per call
	formatDate(date) {
		return dateFormat.format(new Date(date));
	}
}
