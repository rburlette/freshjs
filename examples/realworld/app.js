import {conduitElement} from './lib/conduit-element.js';
import {session, restoreSession, onSessionChange} from './lib/session.js';
import {route, navigate, onRouteChange} from './lib/router.js';
import './components/article-list.js';
import './pages/home-page.js';
import './pages/auth-page.js';
import './pages/settings-page.js';
import './pages/editor-page.js';
import './pages/article-page.js';
import './pages/profile-page.js';

const templateString = /*html*/`
<nav class="navbar navbar-light">
	<div class="container">
		<a class="navbar-brand" href="/">conduit</a>
		<ul class="nav navbar-nav pull-xs-right">
			<li class="nav-item"><a [class]="this.navLink('/')" href="/">Home</a></li>
			<li class="nav-item" fjs-if="this.session.state === 'unavailable'"><span class="nav-link">Connecting…</span></li>
			<li class="nav-item" fjs-if="!this.session.user"><a [class]="this.navLink('/login')" href="/login">Sign in</a></li>
			<li class="nav-item" fjs-if="!this.session.user"><a [class]="this.navLink('/register')" href="/register">Sign up</a></li>
			<li class="nav-item" fjs-if="this.session.user">
				<a [class]="this.navLink('/editor')" href="/editor"><i class="ion-compose"></i>&nbsp;New Article</a>
			</li>
			<li class="nav-item" fjs-if="this.session.user">
				<a [class]="this.navLink('/settings')" href="/settings"><i class="ion-gear-a"></i>&nbsp;Settings</a>
			</li>
			<li class="nav-item" fjs-if="this.session.user">
				<a [class]="this.navLink('/profile/' + this.session.user.username)" [href]="'/profile/' + this.session.user.username">
					<img class="user-pic" [src]="this.avatar(this.session.user.image)">
					{{this.session.user.username}}
				</a>
			</li>
		</ul>
	</div>
</nav>

<home-page fjs-if="this.route.name === 'home'" [.route]="this.route"></home-page>
<auth-page fjs-if="this.route.name === 'login' || this.route.name === 'register'" [.route]="this.route"></auth-page>
<settings-page fjs-if="this.route.name === 'settings'" [.route]="this.route"></settings-page>
<editor-page fjs-if="this.route.name === 'editor'" [.route]="this.route"></editor-page>
<article-page fjs-if="this.route.name === 'article'" [.route]="this.route"></article-page>
<profile-page fjs-if="this.route.name === 'profile' || this.route.name === 'favorites'" [.route]="this.route"></profile-page>
<div class="container page" fjs-if="this.route.name === 'not-found'"><h1>Page not found</h1></div>

<footer>
	<div class="container">
		<a href="/" class="logo-font">conduit</a>
		<span class="attribution">An interactive learning project. Code &amp; design licensed under MIT.</span>
	</div>
</footer>
`;

// The app shell: the navbar, the current page and the footer. Route and session changes don't
// come from events in this template, so it listens for them and refreshes itself.
class conduitApp extends conduitElement {
	constructor() {
		super(templateString);
		this.session = session;
		onRouteChange(() => this.update());
		onSessionChange(() => this.update());
	}

	get route() {
		return route;
	}

	navLink(path) {
		return 'nav-link' + (route.path === path ? ' active' : '');
	}

	// pages that need a signed-in user send everyone else to /login
	update() {
		let needsUser = route.name === 'settings' || route.name === 'editor' || route.query.get('feed') === 'following';
		if(needsUser && session.state === 'unauthenticated')
			return navigate('/login', {replace: true});
		this.refresh();
	}
}

customElements.define('conduit-app', conduitApp);
restoreSession();
