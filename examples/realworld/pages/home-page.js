import {conduitElement} from '../lib/conduit-element.js';
import {api} from '../lib/api.js';
import {session} from '../lib/session.js';
import {pageSize} from '../components/article-list.js';

const templateString = /*html*/`
<div class="home-page">
	<div class="banner">
		<div class="container">
			<h1 class="logo-font">conduit</h1>
			<p>A place to share your knowledge.</p>
		</div>
	</div>

	<div class="container page">
		<div class="row">
			<div class="col-md-9">
				<div class="feed-toggle">
					<ul class="nav nav-pills outline-active">
						<li class="nav-item" fjs-if="this.session.user">
							<a [class]="'nav-link' + (this.feed === 'following' ? ' active' : '')" href="/?feed=following">Your Feed</a>
						</li>
						<li class="nav-item">
							<a [class]="'nav-link' + (this.feed === 'global' ? ' active' : '')" href="/">Global Feed</a>
						</li>
						<li class="nav-item" fjs-if="this.tag">
							<a class="nav-link active" [href]="'/tag/' + encodeURIComponent(this.tag)"><i class="ion-pound"></i> {{this.tag}}</a>
						</li>
					</ul>
				</div>

				<article-list [.path]="this.listPath" [.page]="this.page"></article-list>
			</div>

			<div class="col-md-3">
				<div class="sidebar">
					<p>Popular Tags</p>
					<div class="tag-list">
						<a class="tag-pill tag-default" fjs-for="tag in this.tags" [href]="'/tag/' + encodeURIComponent(tag)">{{tag}}</a>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
`;

class homePage extends conduitElement {
	constructor() {
		super(templateString);
		this.session = session;
		this.tags = [];
	}

	// the app sets a new route on every visit; the list reloads when its path changes
	set route(route) {
		this.currentRoute = route;
		this.loadTags();
	}

	get route() {
		return this.currentRoute;
	}

	get tag() {
		return this.route.params.tag;
	}

	get feed() {
		return this.tag ? 'tag' : this.route.query.get('feed') === 'following' ? 'following' : 'global';
	}

	get page() {
		return Math.max(1, Number(this.route.query.get('page')) || 1);
	}

	get listPath() {
		let query = 'limit=' + pageSize + '&offset=' + (this.page - 1) * pageSize;
		if(this.feed === 'following')
			return '/articles/feed?' + query;
		if(this.tag)
			return '/articles?tag=' + encodeURIComponent(this.tag) + '&' + query;
		return '/articles?' + query;
	}

	async loadTags() {
		try {
			this.tags = (await api('GET', '/tags')).tags;
		} catch {
			this.tags = [];
		}
		this.refresh();
	}
}

customElements.define('home-page', homePage);
