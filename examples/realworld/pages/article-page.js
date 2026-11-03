import {conduitElement} from '../lib/conduit-element.js';
import {api, errorMessages} from '../lib/api.js';
import {session} from '../lib/session.js';
import {markdown} from '../lib/markdown.js';
import '../components/article-meta.js';

const templateString = /*html*/`
<div class="article-page">
<div fjs-if="this.article">
	<div class="banner">
		<div class="container">
			<h1>{{this.article.title}}</h1>
			<article-meta [.article]="this.article" (updated)="this.refresh()"></article-meta>
		</div>
	</div>

	<div class="container page">
		<div class="row article-content">
			<div class="col-md-12">
				<!-- the markdown is escaped before it becomes HTML, so it can't add scripts -->
				<div [.innerHTML]="this.bodyHtml"></div>
				<ul class="tag-list">
					<li class="tag-default tag-pill tag-outline" fjs-for="tag in this.article.tagList">{{tag}}</li>
				</ul>
			</div>
		</div>

		<hr>

		<div class="article-actions">
			<article-meta [.article]="this.article" (updated)="this.refresh()"></article-meta>
		</div>

		<div class="row">
			<div class="col-xs-12 col-md-8 offset-md-2">
				<p fjs-if="!this.session.user">
					<a href="/register">Sign up</a> or sign in to add comments on this article.
				</p>

				<ul class="error-messages" fjs-if="this.errors.length">
					<li fjs-for="error in this.errors">{{error}}</li>
				</ul>

				<form class="card comment-form" fjs-if="this.session.user" (submit)="this.postComment(event)">
					<div class="card-block">
						<textarea class="form-control" placeholder="Write a comment..." rows="3" [.value]="this.newComment" (input)="this.newComment = event.target.value"></textarea>
					</div>
					<div class="card-footer">
						<img class="comment-author-img" [src]="this.avatar(this.session.user.image)">
						<button class="btn btn-sm btn-primary" type="submit">Post Comment</button>
					</div>
				</form>

				<div class="card" fjs-for="comment in this.comments" fjs-key="comment.id">
					<div class="card-block">
						<p class="card-text">{{comment.body}}</p>
					</div>
					<div class="card-footer">
						<a class="comment-author" [href]="'/profile/' + comment.author.username">
							<img class="comment-author-img" [src]="this.avatar(comment.author.image)">
						</a>
						&nbsp;
						<a class="comment-author" [href]="'/profile/' + comment.author.username">{{comment.author.username}}</a>
						<span class="date-posted">{{this.formatDate(comment.createdAt)}}</span>
						<span class="mod-options" fjs-if="comment.author.username === this.session.user?.username">
							<i class="ion-trash-a" (click)="this.deleteComment(comment)"></i>
						</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<div class="container page" fjs-if="this.problem">
	<h1>{{this.problem}}</h1>
</div>
</div>
`;

class articlePage extends conduitElement {
	constructor() {
		super(templateString);
		this.session = session;
		this.article = null;
		this.comments = [];
		this.errors = [];
		this.newComment = '';
	}

	set route(route) {
		this.slug = route.params.slug;
		this.article = null;
		this.comments = [];
		this.errors = [];
		this.problem = null;
		this.load(this.slug);
	}

	get bodyHtml() {
		return markdown(this.article.body);
	}

	async load(slug) {
		try {
			let [{article}, {comments}] = await Promise.all([
				api('GET', '/articles/' + slug),
				api('GET', '/articles/' + slug + '/comments')
			]);
			if(slug !== this.slug)
				return;
			this.article = article;
			this.comments = comments;
		} catch(error) {
			this.problem = error.status === 404 ? 'Article not found' : errorMessages(error)[0];
		}
		this.refresh();
	}

	async postComment(event) {
		event.preventDefault();
		this.errors = [];

		try {
			let {comment} = await api('POST', '/articles/' + this.slug + '/comments', {comment: {body: this.newComment}});
			this.comments = [comment, ...this.comments];
			this.newComment = '';
		} catch(error) {
			this.errors = errorMessages(error);
		}
	}

	async deleteComment(comment) {
		this.errors = [];

		try {
			await api('DELETE', '/articles/' + this.slug + '/comments/' + comment.id);
			this.comments = this.comments.filter(other => other !== comment);
		} catch(error) {
			this.errors = errorMessages(error);
		}
	}
}

customElements.define('article-page', articlePage);
