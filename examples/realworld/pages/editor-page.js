import {conduitElement} from '../lib/conduit-element.js';
import {api, errorMessages} from '../lib/api.js';
import {navigate} from '../lib/router.js';

const templateString = /*html*/`
<div class="editor-page">
	<div class="container page">
		<div class="row">
			<div class="col-md-10 offset-md-1 col-xs-12">
				<ul class="error-messages" fjs-if="this.errors.length">
					<li fjs-for="error in this.errors">{{error}}</li>
				</ul>

				<form (input)="this.form[event.target.name] = event.target.value" (submit)="this.publish(event)">
					<fieldset>
						<fieldset class="form-group">
							<input type="text" class="form-control form-control-lg" name="title" placeholder="Article Title" [.value]="this.form.title">
						</fieldset>
						<fieldset class="form-group">
							<input type="text" class="form-control" name="description" placeholder="What's this article about?" [.value]="this.form.description">
						</fieldset>
						<fieldset class="form-group">
							<textarea class="form-control" rows="8" name="body" placeholder="Write your article (in markdown)" [.value]="this.form.body"></textarea>
						</fieldset>
						<fieldset class="form-group">
							<input type="text" class="form-control" name="tag" placeholder="Enter tags" [.value]="this.form.tag" (keydown)="this.tagKey(event)">
							<div class="tag-list">
								<span class="tag-default tag-pill" fjs-for="tag in this.tagList" fjs-key="tag">
									<i class="ion-close-round" (click)="this.removeTag(tag)"></i> {{tag}}
								</span>
							</div>
						</fieldset>
						<button class="btn btn-lg pull-xs-right btn-primary" type="submit" [disabled]="this.busy">Publish Article</button>
					</fieldset>
				</form>
			</div>
		</div>
	</div>
</div>
`;

// Writes a new article at /editor, or edits one at /editor/its-slug.
class editorPage extends conduitElement {
	constructor() {
		super(templateString);
		this.form = {};
		this.tagList = [];
		this.errors = [];
	}

	set route(route) {
		this.slug = route.params.slug;
		this.form = {title: '', description: '', body: '', tag: ''};
		this.tagList = [];
		this.errors = [];
		if(this.slug)
			this.load(this.slug);
	}

	async load(slug) {
		try {
			let {article} = await api('GET', '/articles/' + slug);
			if(slug !== this.slug)
				return;
			this.form = {title: article.title, description: article.description, body: article.body, tag: ''};
			this.tagList = article.tagList;
		} catch(error) {
			this.errors = errorMessages(error);
		}
		this.refresh();
	}

	// Enter adds a tag instead of submitting the form
	tagKey(event) {
		if(event.key !== 'Enter')
			return;
		event.preventDefault();

		let tag = this.form.tag.trim();
		if(tag && !this.tagList.includes(tag))
			this.tagList = [...this.tagList, tag];
		this.form.tag = '';
	}

	removeTag(tag) {
		this.tagList = this.tagList.filter(other => other !== tag);
	}

	async publish(event) {
		event.preventDefault();
		this.busy = true;
		this.errors = [];
		this.refresh();

		let {title, description, body} = this.form;
		let article = {title, description, body, tagList: this.tagList};

		try {
			let saved = this.slug
				? await api('PUT', '/articles/' + this.slug, {article})
				: await api('POST', '/articles', {article});
			navigate('/article/' + saved.article.slug);
		} catch(error) {
			this.errors = errorMessages(error);
		}
		this.busy = false;
	}
}

customElements.define('editor-page', editorPage);
