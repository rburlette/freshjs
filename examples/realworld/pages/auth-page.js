import {conduitElement} from '../lib/conduit-element.js';
import {api, errorMessages} from '../lib/api.js';
import {signIn} from '../lib/session.js';
import {navigate} from '../lib/router.js';

const templateString = /*html*/`
<div class="auth-page">
	<div class="container page">
		<div class="row">
			<div class="col-md-6 offset-md-3 col-xs-12">
				<h1 class="text-xs-center">{{this.isRegister ? 'Sign up' : 'Sign in'}}</h1>
				<p class="text-xs-center">
					<a fjs-if="this.isRegister" href="/login">Have an account?</a>
					<a fjs-if="!this.isRegister" href="/register">Need an account?</a>
				</p>

				<ul class="error-messages" fjs-if="this.errors.length">
					<li fjs-for="error in this.errors">{{error}}</li>
				</ul>

				<!-- one (input) handler for the whole form: each field updates the value with its name -->
				<form (input)="this.form[event.target.name] = event.target.value" (submit)="this.submit(event)">
					<fieldset class="form-group" fjs-if="this.isRegister">
						<input class="form-control form-control-lg" type="text" name="username" placeholder="Username" [.value]="this.form.username">
					</fieldset>
					<fieldset class="form-group">
						<input class="form-control form-control-lg" type="text" name="email" placeholder="Email" [.value]="this.form.email">
					</fieldset>
					<fieldset class="form-group">
						<input class="form-control form-control-lg" type="password" name="password" placeholder="Password" [.value]="this.form.password">
					</fieldset>
					<button class="btn btn-lg btn-primary pull-xs-right" type="submit" [disabled]="this.busy">{{this.isRegister ? 'Sign up' : 'Sign in'}}</button>
				</form>
			</div>
		</div>
	</div>
</div>
`;

// Sign in at /login and sign up at /register.
class authPage extends conduitElement {
	constructor() {
		super(templateString);
		this.form = {};
		this.errors = [];
	}

	set route(route) {
		this.currentRoute = route;
		this.form = {username: '', email: '', password: ''};
		this.errors = [];
	}

	get route() {
		return this.currentRoute;
	}

	get isRegister() {
		return this.route.name === 'register';
	}

	async submit(event) {
		event.preventDefault();
		this.busy = true;
		this.errors = [];
		this.refresh();

		let {username, email, password} = this.form;
		try {
			let {user} = this.isRegister
				? await api('POST', '/users', {user: {username, email, password}})
				: await api('POST', '/users/login', {user: {email, password}});
			signIn(user);
			navigate('/');
		} catch(error) {
			this.errors = errorMessages(error);
		}
		this.busy = false;
	}
}

customElements.define('auth-page', authPage);
