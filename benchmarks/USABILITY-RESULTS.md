# FreshJS usability and state improvements

Implemented on top of the first fixes commit, `b067bfd29b7de481db63aa69cb5a9964a54a52d2`, on `fix/runtime-and-benchmarks`. Published on GitHub with the same file trees: the first fixes commit is `cf7c0754b8a9134b20c0a9265e6d5b9c907b9e20` and the usability/state commit is `d08a5c5b440c2d5d576de6eaea517e5ef302d425`. GitHub API publication assigned new commit IDs; the measurements below retain their original local IDs and source hashes. Reproduction commands use the published baseline.

## Delivered features

- **Optional automatic updates:** `reactive(element, initial)` observes nested plain data and batches component refreshes.
- **Shared state:** `createStore()` and `useStore()` synchronize connected components and unsubscribe them while disconnected.
- **Derived values and observers:** lazy `computed()` caches and microtask-batched `watch()` callbacks, with explicit disposal.
- **Lifecycle resources:** `onMount()` starts resources after construction, cleans up on disconnect, and restarts on reconnect; it also returns a disposer.
- **Template ergonomics:** nested loops inherit outer variables; `(item, itemIndex)` aliases expose outer indices; kebab-case property bindings address camelCase properties.
- **Diagnostics:** syntax/evaluation errors report the component and binding expression with the original cause; unsupported list inputs and malformed directives fail explicitly.
- **Late component registration:** child inputs are applied after upgrade, preserving setters and supplying the latest parent values before rendering.
- **No-eval CSP:** standalone `fresh-csp.js` supports callback templates and never generates JavaScript from strings. The enforcing-CSP demo renders and handles clicks with no eval or inline-script permission.
- **No application build:** `fresh.js` and `fresh-csp.js` are committed standalone alternatives. Optional `fresh-state.js` has no imports. The maintainer packaging script uses only Node built-ins and is checked in CI.

## Validation

- **28 Chromium regression tests passed**, covering both existing behavior and the new APIs, including CSP enforcement, nested keyed event closures, late upgraded setters/defaults, subscription disposal and reconnect, and native/custom property differences.
- The shared-state example passed a separate interaction smoke check: update both counters, disconnect one, update again, reconnect, and confirm the current value.
- The updated standard benchmark entry again passed upstream `isKeyed` checks for table markup, run/replace, removal, and swaps. [Validation transcript](usability-standard-validation.json).
- The earlier Firefox sandbox and WebKit system-dependency blockers remain; no new cross-engine validation is claimed. CI is configured for all three engines.
- The complete upstream CPU/memory/startup suite was not run. The exported standard table still uses string expressions; the separate callback demo is the tested no-eval CSP path.

## Size

Unminified files, measured as raw bytes and independently compressed with gzip level 9 / Brotli quality 11. Choose one renderer; loading both is unnecessary for a normal application.

| File | Raw bytes | Gzip bytes | Brotli bytes |
| --- | ---: | ---: | ---: |
| Previous renderer (`b067bfd`) | 12,318 | 3,327 | 2,859 |
| Updated `fresh.js` | 13,272 | 4,222 | 3,646 |
| Alternative `fresh-csp.js` | 13,009 | 4,143 | 3,581 |
| Optional `fresh-state.js` | 2,696 | 1,007 | 862 |

The standard renderer adds **895 gzip bytes** (+26.9%). Opting into reactive state adds another **1,007 gzip bytes** as a separate request, for **5,229 bytes total** with the standard renderer. The no-eval renderer plus state totals **5,150 gzip bytes**. These are runtime sizes, not full application payloads.

## Paired performance comparison

Headless Chromium 153.0.8010.0, AMD EPYC 9V74 80-Core Processor, shared Linux host. **9 samples per workload/version**, two discarded warmup rounds, additional per-operation warmups, and rotating version order. Before = `b067bfd`; after = source hashes recorded in the JSON (measured while uncommitted).

Medians in milliseconds for state mutation, DOM commit, and forced layout. Data generation, loading, parsing, paint, and validation are excluded. No reactive state is used in this renderer comparison; it measures the cost of the changed core. All samples validate output and retained keyed DOM identity.

| Operation | Before | After |
| --- | ---: | ---: |
| Create 1,000 rows | 46.8 | 48.1 |
| Create 10,000 rows | 532.9 | 567.3 |
| Replace 1,000 rows | 42.6 | 42.3 |
| Update every tenth row | 5.6 | 6.0 |
| Update one row | 5.6 | 5.7 |
| Select a row | 1.5 | 1.3 |
| Swap distant rows | 4.6 | 4.0 |
| Remove one row | 5.5 | 4.5 |
| Append 1,000 rows | 45.2 | 44.0 |
| Shrink to 10 rows | 9.5 | 6.7 |
| Clear rows | 5.5 | 5.8 |
| Unchanged refresh | 1.0 | 1.0 |

The update is **not a universal speedup**. In this run, creating 10,000 rows increased from 532.9 to 567.3 ms (+6.5%); unchanged refresh stayed at 1.0 ms, and several update/reorder operations were comparable or faster. Nine samples on a shared host are directional evidence, not proof that small differences will persist on another machine. The principal tradeoff is broader functionality at a modest size and rendering cost.

Raw samples and source hashes: [usability-comparison.json](usability-comparison.json). The previous React-alternative comparison remains in [RESULTS.md](RESULTS.md) as a historical snapshot, not a measurement of this revised runtime.

## API boundaries

- Reactivity is **store-level**, not per-binding dependency tracking. Any observed mutation invalidates that store's computed values and refreshes its connected subscribers. Plain fields remain explicit.
- Dates, Maps, Sets, class instances and non-extensible objects are opaque. Mutate observed plain objects/arrays through their proxy; replace containing properties for opaque values.
- Watchers compare their selected result by identity/value with `Object.is`; they are not deep comparison watchers. Owners dispose standalone watchers/computed values.
- String templates still use a simple `{{...}}` delimiter parser. Callback templates are the supported escape hatch for complex JavaScript and no-eval CSP; Trusted Types enforcement is separate.
- Routing, advanced form packages, SSR/hydration and developer extensions are not included. The scope of this change is the four recommended core improvements, keeping broader application infrastructure optional.

Usage and migration examples: [project README](../README.md). Runnable examples: `/examples/csp/` and `/examples/shared/`.
