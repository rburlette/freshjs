import {api} from './api.js';

// Who is signed in, shared by every component. state is 'loading', 'authenticated',
// 'unauthenticated', or 'unavailable' when the API can't be reached: then the token is kept and
// checked again a little later.
export const session = {user: null, state: 'loading'};

const listeners = new Set();

// Components outside an event (like the app shell) use this to refresh when the session changes.
export function onSessionChange(listener) {
	listeners.add(listener);
}

function changed() {
	for(let listener of listeners)
		listener();
}

export async function restoreSession() {
	if(!localStorage.getItem('jwtToken')) {
		session.state = 'unauthenticated';
		return changed();
	}

	try {
		signIn((await api('GET', '/user')).user);
	} catch(error) {
		if(error.status >= 400 && error.status < 500) {
			signOut(); // the API turned the token down
		} else {
			session.state = 'unavailable';
			changed();
			setTimeout(restoreSession, 5000);
		}
	}
}

export function signIn(user) {
	localStorage.setItem('jwtToken', user.token);
	session.user = user;
	session.state = 'authenticated';
	changed();
}

export function signOut() {
	localStorage.removeItem('jwtToken');
	session.user = null;
	session.state = 'unauthenticated';
	changed();
}

// used by the shared RealWorld end-to-end tests
window.__conduit_debug__ = {
	getToken: () => localStorage.getItem('jwtToken'),
	getAuthState: () => session.state,
	getCurrentUser: () => session.user
};
