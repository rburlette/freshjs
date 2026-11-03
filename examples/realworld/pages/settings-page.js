import {conduitElement} from '../lib/conduit-element.js';
import {api, errorMessages} from '../lib/api.js';
import {session, signIn, signOut} from '../lib/session.js';
import {navigate} from '../lib/router.js';

const templateString = /*html*/`
<div class="settings-page">
	<div class="container page">
		<div class="row">
			<div class="col-md-6 offset-md-3 col-xs-12">
				<h1 class="text-xs-center">Your Settings</h1>

				<ul class="error-messages" fjs-if="this.errors.length">
					<li fjs-for="error in this.errors">{{error}}</li>
				</ul>

				<form (input)="this.form[event.target.name] = event.target.value" (submit)="this.submit(event)">
					<fieldset>
						<fieldset class="form-group">
							<input class="form-control" type="text" name="image" placeholder="URL of profile picture" [.value]="this.form.image">
						</fieldset>
						<fieldset class="form-group">
							<input class="form-control form-control-lg" type="text" name="username" placeholder="Your Name" [.value]="this.form.username">
						</fieldset>
						<fieldset class="form-group">
							<textarea class="form-control form-control-lg" rows="8" name="bio" placeholder="Short bio about you" [.value]="this.form.bio"></textarea>
						</fieldset>
						<fieldset class="form-group">
							<input class="form-control form-control-lg" type="text" name="email" placeholder="Email" [.value]="this.form.email">
						</fieldset>
						<fieldset class="form-group">
							<input class="form-control form-control-lg" type="password" name="password" placeholder="New Password" [.value]="this.form.password">
						</fieldset>
						<button class="btn btn-lg btn-primary pull-xs-right" type="submit" [disabled]="this.busy">Update Settings</button>
					</fieldset>
				</form>
				<hr>
				<button class="btn btn-outline-danger" (click)="this.logout()">Or click here to logout.</button>
			</div>
		</div>
	</div>
</div>
`;

class settingsPage extends conduitElement {
	constructor() {
		super(templateString);
		this.form = {};
		this.errors = [];
	}

	set route(route) {
		this.formUser = null; // fill the form again on every visit
		this.errors = [];
	}

	// the signed-in user may arrive after this page is shown, so fill the form when it does
	refresh() {
		if(session.user && this.formUser !== session.user) {
			let {image, username, bio, email} = session.user;
			this.form = {image: image || '', username, bio: bio || '', email, password: ''};
			this.formUser = session.user;
		}
		super.refresh();
	}

	async submit(event) {
		event.preventDefault();
		this.busy = true;
		this.errors = [];
		this.refresh();

		let {password, ...changes} = this.form;
		if(password)
			changes.password = password;

		try {
			let {user} = await api('PUT', '/user', {user: changes});
			signIn(user);
			navigate('/profile/' + encodeURIComponent(user.username));
		} catch(error) {
			this.errors = errorMessages(error);
		}
		this.busy = false;
	}

	logout() {
		signOut();
		navigate('/');
	}
}

customElements.define('settings-page', settingsPage);
