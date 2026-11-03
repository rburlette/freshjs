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
  so every component adopts the same parsed copy of the theme (`adoptedStyleSheets`). The page
  adopts it too, so it's downloaded once.
* **Reacting to new properties.** A page has a `route` setter, which runs when the app passes it a
  new route, and starts loading data. A binding only sets a property when its value changes, so
  the article list checks its inputs in `refresh()` instead: it must also reload when someone
  signs in, while its path stays the same.
* **Hidden pages keep their state.** `fjs-if` keeps what it hides and shows the same elements
  again, refreshed. (React, and Vue's `v-if`, throw hidden parts away and build them again.)
* **Data that arrives later.** Methods that load data call `this.refresh()` when it arrives,
  because that happens after the event that started it.
* **Shared state.** The session and router keep a list of listeners; the app shell refreshes when
  either changes.
* **Forms.** One `(input)` handler on the `<form>` stores each field under its `name`.
* **A faster first load.** Without a build step, the browser finds each import only after the
  file that imports it arrives. `index.html` lists the deepest files with `modulepreload`, so
  they all download at once.

## Tests

The official [RealWorld end-to-end tests](https://github.com/gothinkster/realworld/tree/main/specs/e2e)
pass 131 of 140 as they are. The 9 that fail all use a helper that counts comments with
`document.querySelectorAll()`, which can't see inside shadow DOM. With that helper counting through
Playwright locators instead, all 140 pass.

To run them against this local server, two test files that hard-code the public demo API were
pointed at the local one, and the icon font was served locally because the test machine couldn't
reach its CDN.

## How it compares

RealWorld apps in other frameworks were run against the same local API in headless Chromium, with
the same steps. Times are the median of 5 runs, from the click until the page shows the new
content, including the API call. The second number is with the CPU slowed down 4×, roughly a
mid-range phone.

| | FreshJS | Vue 3 | React 16 | Svelte 5 | Angular 21 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Download, gzipped | 26 KB | 52 KB | 92 KB | 54 KB | 108 KB |
| JavaScript heap after loading | 1.4 MB | 2.4 MB | 2.3 MB | 1.8 MB | 3.4 MB |
| Lines of app code | 1,011 | 1,848 | 2,086 | 1,153 | 2,218 |
| First load (ms) | 128 / 382 | 120 / 445 | 138 / 486 | 123 / 349 | 175 / 634 |
| Next page of articles | 13 / 44 | 20 / 60 | 14 / 56 | 22 / 77 | 21 / 77 |
| A tag's articles | 15 / 46 | 20 / 87 | 12 / 33 | 21 / 38 | 27 / 106 |
| Back to the global feed | 12 / 32 | 21 / 76 | 10 / 34 | 25 / 45 | 20 / 82 |
| Open an article | 14 / 48 | 60 / 204 | 18 / 64 | 27 / 53 | 78 / 227 |
| Favorite an article | 8 / 23 | 10 / 35 | 8 / 25 | 26 / 60 | 10 / 28 |
| Post a comment | 9 / 24 | 10 / 30 | 11 / 36 | 21 / 50 | 11 / 35 |
| Open a profile | 19 / 56 | 27 / 82 | 14 / 44 | 30 / 56 | 58 / 155 |

* The apps: [Vue](https://github.com/mutoe/vue3-realworld-example-app),
  [React](https://github.com/gothinkster/react-redux-realworld-example-app) (with Redux, last
  updated in 2021), [Svelte](https://github.com/sveltejs/realworld) (SvelteKit) and
  [Angular](https://github.com/realworld-apps/angular-realworld-example-app). Each was built for
  production and pointed at the local API. The only other change was to Svelte's favorite button,
  which didn't work with the current SvelteKit and Svelte 5 (two small fixes).
* Svelte renders pages on its own server: the first page arrives with its articles in it, and
  each later page asks that server, which asks the API.
* Vue, Svelte and Angular download a page's code the first time it opens, which is most of their
  time to open an article. FreshJS loads every page at the start, in 15 small JavaScript files.
* Lines of code are non-blank lines in each app's own source, without tests, the theme or
  generated API clients.
* Times vary by 10 to 20% from run to run, so a few milliseconds' difference means nothing.

## Credits

`styles.css` and `default-avatar.svg` are from the RealWorld project, MIT License,
Copyright (c) 2021 Thinkster.
