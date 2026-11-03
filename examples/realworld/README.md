# RealWorld ("Conduit") in FreshJS

[RealWorld](https://github.com/gothinkster/realworld) is a Medium-style blogging app with the same
design and API in dozens of frameworks. This is that app in FreshJS: routing, sign up and sign in,
a global feed, your feed and tag feeds with pagination, articles in markdown, comments, favorites,
following, profiles, settings and an article editor.

## Run it

```sh
node examples/realworld/server.mjs
```

Then open http://localhost:3000. The server has no dependencies. It serves the app and a small
stand-in for the RealWorld API, which keeps its data in memory and starts from the same sample
articles every time. Every sample user's password is `password123` (for example
`johndoe@example.com`).

## How it's built

| File | What it does |
| --- | --- |
| `app.js` | The app shell: navbar, the current page, footer. |
| `pages/*.js` | One component per page: home, sign in/up, settings, editor, article, profile. |
| `components/article-list.js` | Article previews and pagination, used by home and profile. |
| `components/article-meta.js` | The author line and buttons above and below an article. |
| `lib/router.js` | Turns the URL into a route and catches link clicks, so pages change without reloading. |
| `lib/session.js` | Who is signed in, shared by every component. |
| `lib/api.js` | Calls the API and turns its errors into messages. |
| `lib/markdown.js` | Escapes article text, then turns a small markdown subset into HTML. |
| `lib/conduit-element.js` | The base component: shared styles and template helpers. |
| `server.mjs` | The stand-in API and file server. |

A few patterns fill gaps that FreshJS doesn't cover itself:

* **Shared styles.** Components render in shadow DOM, where the page's stylesheet doesn't reach,
  so every component adopts the same parsed copy of the theme (`adoptedStyleSheets`).
* **Reacting to new properties.** A page has a `route` setter, which runs when the app passes it a
  new route, and starts loading data.
* **Data that arrives later.** Methods that load data call `this.refresh()` when it arrives,
  because that happens after the event that started it.
* **Shared state.** The session and router keep a list of listeners; the app shell refreshes when
  either changes.
* **Forms.** One `(input)` handler on the `<form>` stores each field under its `name`.

## Tests

The official [RealWorld end-to-end tests](https://github.com/gothinkster/realworld/tree/main/specs/e2e)
pass 131 of 140 as they are. The 9 that fail all use a helper that counts comments with
`document.querySelectorAll()`, which can't see inside shadow DOM. With that helper counting through
Playwright locators instead, all 140 pass.

To run them against this local server, two test files that hard-code the public demo API were
pointed at the local one, and the icon font was served locally because the test machine couldn't
reach its CDN.

## Credits

`styles.css` and `default-avatar.svg` are from the RealWorld project, MIT License,
Copyright (c) 2021 Thinkster.
