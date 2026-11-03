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
| `lib/conduit-element.js` | The base component: renders in the page, and has helpers templates can call. |
| `server.mjs` | The stand-in API and file server. |

A few patterns fill gaps that FreshJS doesn't cover itself:

* **One stylesheet.** The base component sets `static shadow = false`, so every component renders
  in the page and the theme in `index.html` styles it, rules that span several components included.
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
pass, all 140. (With components in shadow DOM, 9 failed: they count comments with
`document.querySelectorAll()`, which can't see inside a shadow root.)

To run them against this local server, two test files that hard-code the public demo API were
pointed at the local one, and the icon font was served locally because the test machine couldn't
reach its CDN.

## How it compares

RealWorld apps in other frameworks were run against the same local API in headless Chromium, with
the same steps. Times are the median of 10 runs, from the click until the page shows the new
content, including the API call. The second number is with the CPU slowed down 4×, roughly a
mid-range phone. The browser reached nothing outside the machine, so no app had its web fonts or
icon font.

| | FreshJS | Vue 3 | React 16 | Svelte 5 | Angular 21 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Download, gzipped | 26 KB | 52 KB | 92 KB | 54 KB | 108 KB |
| JavaScript heap after loading | 1.4 MB | 2.4 MB | 2.3 MB | 1.8 MB | 3.4 MB |
| Lines of app code | 996 | 1,829 | 2,087 | 1,153 | 2,204 |
| First load (ms) | 92 / 300 | 99 / 373 | 101 / 427 | 112 / 312 | 137 / 624 |
| Next page of articles | 11 / 47 | 13 / 59 | 12 / 46 | 18 / 65 | 16 / 83 |
| A tag's articles | 9 / 39 | 17 / 66 | 8 / 26 | 19 / 34 | 21 / 99 |
| Back to the global feed | 8 / 33 | 14 / 61 | 8 / 27 | 13 / 37 | 14 / 75 |
| Open an article | 10 / 40 | 50 / 196 | 12 / 58 | 23 / 48 | 57 / 200 |
| Favorite an article | 5 / 18 | 7 / 24 | 6 / 17 | 17 / 56 | 7 / 24 |
| Post a comment | 6 / 19 | 9 / 25 | 7 / 22 | 17 / 44 | 8 / 30 |
| Open a profile | 11 / 45 | 21 / 70 | 9 / 39 | 24 / 51 | 35 / 158 |

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
