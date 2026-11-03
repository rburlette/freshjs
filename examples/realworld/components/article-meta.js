import {conduitElement} from '../lib/conduit-element.js';
import {api} from '../lib/api.js';
import {session} from '../lib/session.js';
import {navigate} from '../lib/router.js';

const templateString = /*html*/`
<div class="article-meta">
	<a [href]="'/profile/' + this.article.author.username"><img [src]="this.avatar(this.article.author.image)"></a>
	<div class="info">
		<a class="author" [href]="'/profile/' + this.article.author.username">{{this.article.author.username}}</a>
		<span class="date">{{this.formatDate(this.article.createdAt)}}</span>
	</div>

	<span fjs-if="!this.isAuthor">
		<button [class]="'btn btn-sm ' + (this.article.author.following ? 'btn-secondary' : 'btn-outline-secondary')" (click)="this.toggleFollow()">
			<i class="ion-plus-round"></i>
			&nbsp; {{this.article.author.following ? 'Unfollow' : 'Follow'}} {{this.article.author.username}}
		</button>
		&nbsp;&nbsp;
		<button [class]="'btn btn-sm ' + (this.article.favorited ? 'btn-primary' : 'btn-outline-primary')" (click)="this.toggleFavorite()">
			<i class="ion-heart"></i>
			&nbsp; {{this.article.favorited ? 'Unfavorite' : 'Favorite'}} Article <span class="counter">({{this.article.favoritesCount}})</span>
		</button>
	</span>

	<span fjs-if="this.isAuthor">
		<a class="btn btn-sm btn-outline-secondary" [href]="'/editor/' + this.article.slug"><i class="ion-edit"></i> Edit Article</a>
		&nbsp;&nbsp;
		<button class="btn btn-sm btn-outline-danger" (click)="this.deleteArticle()"><i class="ion-trash-a"></i> Delete Article</button>
	</span>
</div>
`;

// The author, date and buttons above and below an article. Following and favoriting change the
// shared article object, then send an "updated" event so the page refreshes both copies of this.
class articleMeta extends conduitElement {
	constructor() {
		super(templateString);
	}

	get isAuthor() {
		return session.user?.username === this.article.author.username;
	}

	async toggleFollow() {
		if(!session.user)
			return navigate('/login');

		let author = this.article.author;
		let {profile} = await api(author.following ? 'DELETE' : 'POST', '/profiles/' + encodeURIComponent(author.username) + '/follow');
		author.following = profile.following;
		this.emit('updated');
	}

	async toggleFavorite() {
		if(!session.user)
			return navigate('/login');

		let {article} = await api(this.article.favorited ? 'DELETE' : 'POST', '/articles/' + this.article.slug + '/favorite');
		this.article.favorited = article.favorited;
		this.article.favoritesCount = article.favoritesCount;
		this.emit('updated');
	}

	async deleteArticle() {
		await api('DELETE', '/articles/' + this.article.slug);
		navigate('/');
	}
}

customElements.define('article-meta', articleMeta);
