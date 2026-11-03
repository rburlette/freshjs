import {conduitElement} from '../lib/conduit-element.js';
import {api} from '../lib/api.js';
import {session} from '../lib/session.js';
import {navigate} from '../lib/router.js';

export const pageSize = 10;

const templateString = /*html*/`
<div class="article-preview" fjs-if="this.loading">Loading articles...</div>

<div class="article-preview empty-feed-message" fjs-if="!this.loading && this.articles.length === 0">
	<span fjs-if="!this.isFeed">No articles are here... yet.</span>
	<span fjs-if="this.isFeed">Your feed is empty. Follow some authors, or browse the <a href="/">Global Feed</a>.</span>
</div>

<div class="article-preview" fjs-for="article in this.articles" fjs-key="article.slug">
	<div class="article-meta">
		<a [href]="'/profile/' + article.author.username"><img [src]="this.avatar(article.author.image)"></a>
		<div class="info">
			<a class="author" [href]="'/profile/' + article.author.username">{{article.author.username}}</a>
			<span class="date">{{this.formatDate(article.createdAt)}}</span>
		</div>
		<button [class]="'btn btn-sm pull-xs-right ' + (article.favorited ? 'btn-primary' : 'btn-outline-primary')" (click)="this.toggleFavorite(article)">
			<i class="ion-heart"></i> {{article.favoritesCount}}
		</button>
	</div>
	<a class="preview-link" [href]="'/article/' + article.slug">
		<h1>{{article.title}}</h1>
		<p>{{article.description}}</p>
		<span>Read more...</span>
		<ul class="tag-list">
			<li class="tag-default tag-pill tag-outline" fjs-for="tag in article.tagList">{{tag}}</li>
		</ul>
	</a>
</div>

<ul class="pagination" fjs-if="this.pages.length > 1">
	<li fjs-for="page in this.pages" [class]="'page-item' + (page === this.page ? ' active' : '')">
		<a class="page-link" [href]="this.pageUrl(page)">{{page}}</a>
	</li>
</ul>
`;

// A list of article previews with pagination. The page sets [.path] to the API path to load,
// such as /articles?tag=css&limit=10&offset=0, and [.page] to the current page number.
class articleList extends conduitElement {
	constructor() {
		super(templateString);
		this.articles = [];
		this.count = 0;
		this.page = 1;
		this.loading = false;
	}

	// FreshJS has no "property changed" hook, so a setter starts loading when the path changes
	set path(path) {
		if(path === this.loadedPath)
			return;
		this.loadedPath = path;
		this.load();
	}

	get path() {
		return this.loadedPath;
	}

	get isFeed() {
		return (this.loadedPath || '').startsWith('/articles/feed');
	}

	get pages() {
		return Array.from({length: Math.ceil(this.count / pageSize)}, (unused, i) => i + 1);
	}

	async load() {
		let path = this.loadedPath;
		this.loading = true;

		try {
			let {articles, articlesCount} = await api('GET', path);
			if(path !== this.loadedPath)
				return; // a newer list was asked for in the meantime
			this.articles = articles;
			this.count = articlesCount;
		} catch {
			this.articles = [];
			this.count = 0;
		}

		this.loading = false;
		this.refresh(); // the data arrived after any event, so refresh by hand
	}

	// keeps the rest of the address, such as ?feed=following, and changes only the page
	pageUrl(page) {
		let url = new URL(location.href);
		if(page > 1)
			url.searchParams.set('page', page);
		else
			url.searchParams.delete('page');
		return url.pathname + url.search;
	}

	async toggleFavorite(article) {
		if(!session.user)
			return navigate('/login');

		let {article: changed} = await api(article.favorited ? 'DELETE' : 'POST', '/articles/' + article.slug + '/favorite');
		Object.assign(article, changed);
	}
}

customElements.define('article-list', articleList);
