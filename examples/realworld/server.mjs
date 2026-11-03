// A small stand-in for the RealWorld API (https://realworld-docs.netlify.app), plus a file server
// for the FreshJS app in this folder. No dependencies: run `node examples/realworld/server.mjs`
// and open http://localhost:3000. Data lives in memory and starts from the same sample data on
// every run. Set PORT to change the port, and API_ONLY=1 to serve only the API (other apps can
// call it from another origin).

import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import {Buffer} from 'node:buffer';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';

const port = Number(process.env.PORT) || 3000;
const apiOnly = process.env.API_ONLY === '1';
const appFolder = path.dirname(fileURLToPath(import.meta.url));
const repoFolder = path.resolve(appFolder, '../..');

// ---------------------------------------------------------------------------------------------
// Data

let users = [], articles = [], comments = [], nextCommentId = 1;
const sessions = new Map(); // token -> user

class ApiError extends Error {
	constructor(status, field, message) {
		super(message);
		this.status = status;
		this.errors = {[field]: [message]};
	}
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
	return {salt, hash: scryptSync(password, salt, 32).toString('hex')};
}

function passwordMatches(user, password) {
	let {hash} = hashPassword(password, user.salt);
	return timingSafeEqual(Buffer.from(hash), Buffer.from(user.hash));
}

function addUser({username, email, password, bio = null, image = null}) {
	let user = {username, email, bio, image, following: new Set(), ...hashPassword(password)};
	users.push(user);
	return user;
}

function slugify(title) {
	let base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'article';
	let slug = base;
	for(let n = 2; articles.some(article => article.slug === slug); n++)
		slug = base + '-' + n;
	return slug;
}

function addArticle({title, description, body, tagList = [], author, createdAt = new Date()}) {
	let article = {
		slug: slugify(title), title, description, body,
		tagList: [...new Set(tagList.map(tag => String(tag).trim()).filter(Boolean))],
		createdAt, updatedAt: createdAt, author, favoritedBy: new Set()
	};
	articles.push(article);
	return article;
}

function addComment({article, author, body, createdAt = new Date()}) {
	let comment = {id: nextCommentId++, article, author, body, createdAt, updatedAt: createdAt};
	comments.push(comment);
	return comment;
}

// The same sample data on every run: a few authors, 30 articles (three pages of 10) and some
// comments and favorites. Every sample user's password is "password123".
function seed() {
	let names = [['johndoe', 'Writes about building for the web.'], ['janedoe', 'Coffee, code and long walks.'],
		['sam-lee', null], ['ana-garcia', 'Designer who codes.'], ['li-wei', null]];
	let authors = names.map(([username, bio]) => addUser({username, email: username + '@example.com', password: 'password123', bio}));
	let topics = ['javascript', 'webdev', 'design', 'testing', 'performance', 'css', 'html', 'accessibility', 'tooling', 'career'];
	let start = Date.UTC(2024, 0, 1);

	for(let i = 0; i < 30; i++) {
		let topic = topics[i % topics.length], second = topics[(i * 3 + 1) % topics.length];
		addArticle({
			title: 'Notes on ' + topic + ', part ' + (Math.floor(i / topics.length) + 1),
			description: 'What I learned about ' + topic + ' this week.',
			body: '## Why ' + topic + ' matters\n\nA short look at **' + topic + '** in everyday work, with a few *practical* tips.\n\n' +
				'- Start small\n- Measure before you change things\n- Write down what you learned\n\n' +
				'```js\nconsole.log(\'' + topic + '\');\n```\n\nMore at [the RealWorld project](https://github.com/gothinkster/realworld).',
			tagList: topic === second ? [topic] : [topic, second],
			author: authors[i % authors.length],
			createdAt: new Date(start + i * 3600000)
		});
	}

	for(let i = 0; i < articles.length; i += 3) {
		addComment({article: articles[i], author: authors[(i + 1) % authors.length], body: 'Great points, thanks for sharing!', createdAt: new Date(start + i * 3600000 + 600000)});
		addComment({article: articles[i], author: authors[(i + 2) % authors.length], body: 'I tried this and it worked well.', createdAt: new Date(start + i * 3600000 + 1200000)});
	}

	articles.forEach((article, i) => {
		for(let j = 0; j < i % 4; j++)
			article.favoritedBy.add(authors[(i + j + 1) % authors.length]);
	});
}

// ---------------------------------------------------------------------------------------------
// What the API returns

const profileJson = (user, viewer) => ({username: user.username, bio: user.bio, image: user.image, following: !!viewer && viewer.following.has(user)});

const userJson = (user, token) => ({user: {email: user.email, token, username: user.username, bio: user.bio, image: user.image}});

function articleJson(article, viewer, withBody = true) {
	let json = {
		slug: article.slug, title: article.title, description: article.description,
		tagList: article.tagList, createdAt: article.createdAt.toISOString(), updatedAt: article.updatedAt.toISOString(),
		favorited: !!viewer && article.favoritedBy.has(viewer), favoritesCount: article.favoritedBy.size,
		author: profileJson(article.author, viewer)
	};
	if(withBody)
		json.body = article.body;
	return json;
}

const commentJson = (comment, viewer) => ({
	id: comment.id, createdAt: comment.createdAt.toISOString(), updatedAt: comment.updatedAt.toISOString(),
	body: comment.body, author: profileJson(comment.author, viewer)
});

// ---------------------------------------------------------------------------------------------
// Checking requests

const isBlank = value => value === undefined || value === null || String(value).trim() === '';
const isEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function requireFields(object, fields) {
	for(let field of fields)
		if(isBlank(object?.[field]))
			throw new ApiError(422, field, 'can\'t be blank');
}

function checkEmail(email) {
	if(!isEmail(email))
		throw new ApiError(422, 'email', 'is invalid');
}

function checkUnique(field, value, except) {
	if(users.some(user => user !== except && user[field].toLowerCase() === String(value).toLowerCase()))
		throw new ApiError(409, field, 'has already been taken');
}

function findArticle(slug) {
	let article = articles.find(article => article.slug === slug);
	if(!article)
		throw new ApiError(404, 'article', 'not found');
	return article;
}

function findProfile(username) {
	let user = users.find(user => user.username === username);
	if(!user)
		throw new ApiError(404, 'profile', 'not found');
	return user;
}

function signIn(user) {
	let token = randomBytes(24).toString('hex');
	sessions.set(token, user);
	return token;
}

// ---------------------------------------------------------------------------------------------
// Routes: [method, path pattern, handler(request) -> [status, json]]

function listArticles(found, viewer, query) {
	let limit = Math.max(0, Number(query.get('limit') ?? 20) || 0), offset = Math.max(0, Number(query.get('offset')) || 0);
	found = found.sort((a, b) => b.createdAt - a.createdAt);
	return [200, {articles: found.slice(offset, offset + limit).map(article => articleJson(article, viewer, false)), articlesCount: found.length}];
}

function requireUser(request) {
	if(!request.user)
		throw new ApiError(401, 'token', 'is missing');
	return request.user;
}

const routes = [
	['POST', '/api/users/login', ({body}) => {
		requireFields(body.user, ['email', 'password']);
		checkEmail(body.user.email);
		let user = users.find(user => user.email.toLowerCase() === body.user.email.toLowerCase());
		if(!user || !passwordMatches(user, body.user.password))
			throw new ApiError(401, 'credentials', 'invalid');
		return [200, userJson(user, signIn(user))];
	}],

	['POST', '/api/users', ({body}) => {
		requireFields(body.user, ['username', 'email', 'password']);
		checkEmail(body.user.email);
		checkUnique('username', body.user.username);
		checkUnique('email', body.user.email);
		let user = addUser(body.user);
		return [201, userJson(user, signIn(user))];
	}],

	['GET', '/api/user', request => [200, userJson(requireUser(request), request.token)]],

	['PUT', '/api/user', request => {
		let user = requireUser(request), changes = request.body.user || {};
		for(let field of ['username', 'email', 'password'])
			if(field in changes)
				requireFields(changes, [field]);
		if('email' in changes) {
			checkEmail(changes.email);
			checkUnique('email', changes.email, user);
		}
		if('username' in changes)
			checkUnique('username', changes.username, user);
		if('password' in changes && String(changes.password).length < 8)
			throw new ApiError(422, 'password', 'is too short (minimum is 8 characters)');

		for(let field of ['username', 'email', 'bio', 'image'])
			if(field in changes)
				user[field] = isBlank(changes[field]) ? null : changes[field]; // empty bio or image becomes null
		if('password' in changes)
			Object.assign(user, hashPassword(changes.password));
		return [200, userJson(user, request.token)];
	}],

	['GET', '/api/profiles/:username', request => [200, {profile: profileJson(findProfile(request.params.username), request.user)}]],

	['POST', '/api/profiles/:username/follow', request => {
		let viewer = requireUser(request), user = findProfile(request.params.username);
		viewer.following.add(user);
		return [200, {profile: profileJson(user, viewer)}];
	}],

	['DELETE', '/api/profiles/:username/follow', request => {
		let viewer = requireUser(request), user = findProfile(request.params.username);
		viewer.following.delete(user);
		return [200, {profile: profileJson(user, viewer)}];
	}],

	['GET', '/api/articles/feed', request => {
		let viewer = requireUser(request);
		return listArticles(articles.filter(article => viewer.following.has(article.author)), viewer, request.query);
	}],

	['GET', '/api/articles', ({query, user}) => {
		let tag = query.get('tag'), author = query.get('author'), favorited = query.get('favorited');
		return listArticles(articles.filter(article =>
			(!tag || article.tagList.includes(tag)) &&
			(!author || article.author.username === author) &&
			(!favorited || [...article.favoritedBy].some(fan => fan.username === favorited))), user, query);
	}],

	['POST', '/api/articles', request => {
		let author = requireUser(request), fields = request.body.article || {};
		requireFields(fields, ['title', 'description', 'body']);
		let article = addArticle({...fields, tagList: Array.isArray(fields.tagList) ? fields.tagList : [], author});
		return [201, {article: articleJson(article, author)}];
	}],

	['GET', '/api/articles/:slug', ({params, user}) => [200, {article: articleJson(findArticle(params.slug), user)}]],

	['PUT', '/api/articles/:slug', request => {
		let user = requireUser(request), article = findArticle(request.params.slug), changes = request.body.article || {};
		if(article.author !== user)
			throw new ApiError(403, 'article', 'forbidden');
		for(let field of ['title', 'description', 'body'])
			if(field in changes)
				requireFields(changes, [field]);
		if('tagList' in changes && !Array.isArray(changes.tagList))
			throw new ApiError(422, 'tagList', 'must be a list');
		if('title' in changes && changes.title !== article.title) {
			article.slug = '';
			article.slug = slugify(changes.title);
		}
		for(let field of ['title', 'description', 'body'])
			if(field in changes)
				article[field] = changes[field];
		if(Array.isArray(changes.tagList))
			article.tagList = [...new Set(changes.tagList.map(tag => String(tag).trim()).filter(Boolean))];
		article.updatedAt = new Date();
		return [200, {article: articleJson(article, user)}];
	}],

	['DELETE', '/api/articles/:slug', request => {
		let user = requireUser(request), article = findArticle(request.params.slug);
		if(article.author !== user)
			throw new ApiError(403, 'article', 'forbidden');
		articles = articles.filter(other => other !== article);
		comments = comments.filter(comment => comment.article !== article);
		return [204];
	}],

	['GET', '/api/articles/:slug/comments', ({params, user}) => {
		let article = findArticle(params.slug);
		return [200, {comments: comments.filter(comment => comment.article === article).map(comment => commentJson(comment, user))}];
	}],

	['POST', '/api/articles/:slug/comments', request => {
		let author = requireUser(request), article = findArticle(request.params.slug);
		requireFields(request.body.comment, ['body']);
		return [201, {comment: commentJson(addComment({article, author, body: request.body.comment.body}), author)}];
	}],

	['DELETE', '/api/articles/:slug/comments/:id', request => {
		let user = requireUser(request), article = findArticle(request.params.slug);
		let comment = comments.find(comment => comment.article === article && String(comment.id) === request.params.id);
		if(!comment)
			throw new ApiError(404, 'comment', 'not found');
		if(comment.author !== user)
			throw new ApiError(403, 'comment', 'forbidden');
		comments = comments.filter(other => other !== comment);
		return [204];
	}],

	['POST', '/api/articles/:slug/favorite', request => {
		let user = requireUser(request), article = findArticle(request.params.slug);
		article.favoritedBy.add(user);
		return [200, {article: articleJson(article, user)}];
	}],

	['DELETE', '/api/articles/:slug/favorite', request => {
		let user = requireUser(request), article = findArticle(request.params.slug);
		article.favoritedBy.delete(user);
		return [200, {article: articleJson(article, user)}];
	}],

	['GET', '/api/tags', () => {
		let counts = new Map();
		for(let article of articles)
			for(let tag of article.tagList)
				counts.set(tag, (counts.get(tag) || 0) + 1);
		return [200, {tags: [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b))}];
	}]
];

function matchRoute(method, pathname) {
	for(let [routeMethod, pattern, handler] of routes) {
		if(routeMethod !== method)
			continue;
		let names = [], regex = new RegExp('^' + pattern.replace(/:(\w+)/g, (match, name) => { names.push(name); return '([^/]+)'; }) + '/?$');
		let match = pathname.match(regex);
		if(match)
			return {handler, params: Object.fromEntries(names.map((name, i) => [name, decodeURIComponent(match[i + 1])]))};
	}
	return null;
}

async function handleApi(request, response, url) {
	let route = matchRoute(request.method, url.pathname);
	if(!route)
		return send(response, 404, {errors: {path: ['not found']}});

	let chunks = [];
	for await (let chunk of request)
		chunks.push(chunk);

	try {
		let text = Buffer.concat(chunks).toString(), token = (request.headers.authorization || '').replace(/^(Token|Bearer) /, '');
		let body = text ? JSON.parse(text) : {};
		if(token && !sessions.has(token))
			throw new ApiError(401, 'token', 'is invalid');
		let [status, json] = route.handler({body, params: route.params, query: url.searchParams, token, user: sessions.get(token)});
		send(response, status, json);
	} catch(error) {
		if(error instanceof ApiError)
			send(response, error.status, {errors: error.errors});
		else if(error instanceof SyntaxError)
			send(response, 422, {errors: {body: ['is not valid JSON']}});
		else {
			console.error(error);
			send(response, 500, {errors: {server: ['error']}});
		}
	}
}

function send(response, status, json) {
	response.writeHead(status, json ? {'content-type': 'application/json; charset=utf-8'} : {});
	response.end(json ? JSON.stringify(json) : undefined);
}

// ---------------------------------------------------------------------------------------------
// Files for the FreshJS app. Page URLs like /login or /article/some-slug get index.html, and the
// app's router shows the right page.

const types = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'};

async function handleFile(response, url) {
	let pathname = decodeURIComponent(url.pathname);
	let file = pathname === '/fresh.js' ? path.join(repoFolder, 'fresh.js')
		: path.extname(pathname) ? path.join(appFolder, pathname)
		: path.join(appFolder, 'index.html');

	if(!file.startsWith(appFolder + path.sep) && file !== path.join(repoFolder, 'fresh.js'))
		return send(response, 404);

	try {
		let content = await readFile(file);
		response.writeHead(200, {'content-type': types[path.extname(file)] || 'application/octet-stream'});
		response.end(content);
	} catch {
		send(response, 404);
	}
}

seed();

http.createServer((request, response) => {
	let url = new URL(request.url, 'http://localhost');
	response.setHeader('access-control-allow-origin', '*');
	response.setHeader('access-control-allow-headers', 'Content-Type, Authorization');
	response.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');

	if(request.method === 'OPTIONS')
		return send(response, 204);
	if(url.pathname.startsWith('/api/'))
		return handleApi(request, response, url);
	if(apiOnly)
		return send(response, 404);
	return handleFile(response, url);
}).listen(port, () => console.log('RealWorld ' + (apiOnly ? 'API' : 'app and API') + ' on http://localhost:' + port));
