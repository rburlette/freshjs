import {conduitElement} from '../lib/conduit-element.js';
import {api, errorMessages} from '../lib/api.js';
import {session} from '../lib/session.js';
import {navigate} from '../lib/router.js';
import {pageSize} from '../components/article-list.js';

const templateString = /*html*/`
<div class="profile-page">
<div fjs-if="this.profile">
	<div class="user-info">
		<div class="container">
			<div class="row">
				<div class="col-xs-12 col-md-10 offset-md-1">
					<img class="user-img" [src]="this.avatar(this.profile.image)">
					<h4>{{this.profile.username}}</h4>
					<p>{{this.profile.bio}}</p>
					<a fjs-if="this.isMe" class="btn btn-sm btn-outline-secondary action-btn" href="/settings">
						<i class="ion-gear-a"></i>
						&nbsp; Edit Profile Settings
					</a>
					<button fjs-if="!this.isMe" [class]="'btn btn-sm action-btn ' + (this.profile.following ? 'btn-secondary' : 'btn-outline-secondary')" (click)="this.toggleFollow()">
						<i class="ion-plus-round"></i>
						&nbsp; {{this.profile.following ? 'Unfollow' : 'Follow'}} {{this.profile.username}}
					</button>
				</div>
			</div>
		</div>
	</div>

	<div class="container">
		<div class="row">
			<div class="col-xs-12 col-md-10 offset-md-1">
				<div class="articles-toggle">
					<ul class="nav nav-pills outline-active">
						<li class="nav-item">
							<a [class]="'nav-link' + (this.favorites ? '' : ' active')" [href]="'/profile/' + encodeURIComponent(this.profile.username)">My Articles</a>
						</li>
						<li class="nav-item">
							<a [class]="'nav-link' + (this.favorites ? ' active' : '')" [href]="'/profile/' + encodeURIComponent(this.profile.username) + '/favorites'">Favorited Articles</a>
						</li>
					</ul>
				</div>

				<article-list [.path]="this.listPath" [.page]="this.page"></article-list>
			</div>
		</div>
	</div>
</div>

<div class="container page" fjs-if="this.problem">
	<h1>{{this.problem}}</h1>
</div>
</div>
`;

// A user's profile at /profile/name, with their articles, or their favorites at /profile/name/favorites.
class profilePage extends conduitElement {
	constructor() {
		super(templateString);
		this.profile = null;
	}

	set route(route) {
		this.currentRoute = route;
		this.username = route.params.username;
		this.problem = null;
		if(this.profile?.username !== this.username)
			this.profile = null;
		this.load(this.username);
	}

	get route() {
		return this.currentRoute;
	}

	get favorites() {
		return this.route.name === 'favorites';
	}

	get isMe() {
		return session.user?.username === this.profile.username;
	}

	get page() {
		return Math.max(1, Number(this.route.query.get('page')) || 1);
	}

	get listPath() {
		let filter = (this.favorites ? 'favorited=' : 'author=') + encodeURIComponent(this.username);
		return '/articles?' + filter + '&limit=' + pageSize + '&offset=' + (this.page - 1) * pageSize;
	}

	async load(username) {
		try {
			let {profile} = await api('GET', '/profiles/' + encodeURIComponent(username));
			if(username !== this.username)
				return;
			this.profile = profile;
		} catch(error) {
			this.problem = error.status === 404 ? 'Profile not found' : errorMessages(error)[0];
		}
		this.refresh();
	}

	async toggleFollow() {
		if(!session.user)
			return navigate('/login');

		let {profile} = await api(this.profile.following ? 'DELETE' : 'POST', '/profiles/' + encodeURIComponent(this.profile.username) + '/follow');
		this.profile = profile;
	}
}

customElements.define('profile-page', profilePage);
