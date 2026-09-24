# FreshJS fixes and measurements — 2026-09-24

Implemented on branch `fix/runtime-and-benchmarks`, based on upstream FreshJS commit `313f006e47de2d0d6cfb90a118bd94faa5583ec6`. No changes have been pushed to GitHub.

## What changed

- Function property bindings now replace stale handlers and can clear them with `null`. Form value/checked/selected bindings reconcile user edits even if the model value is unchanged.
- Null/undefined lists render empty; removed rows are released. Optional `fjs-key` preserves node/component identity and rejects duplicate keys. Head/tail reconciliation moves only the two affected nodes for a distant swap.
- Connected components render automatically after initialization. `document.importNode` upgrades cloned custom elements before bindings refresh. Synchronous `refresh()` remains; optional `requestRefresh()` batches within a microtask.
- Replaced the unfinished React-derived TodoMVC files with a standalone example supporting add/edit/cancel/filter/toggle/remove/clear and optional persistence.
- Added usage documentation, browser regressions, a three-browser CI workflow, local comparison/mount/size scripts, and an exportable standard benchmark implementation. Production use still needs only `fresh.js`.

## Validation

- **15 Chromium browser tests passed**, including the original demo, a complete todo interaction flow, 250 deterministic randomized keyed list changes, focus/component-state preservation, and a two-node swap mutation check.
- **Upstream `isKeyed` passed** table markup and run/replace, remove and swap keyed checks at js-framework-benchmark revision `f2df01a8679de05225c32714ca8cecbea3d78c5d`. The exported native module entry also passed its `build-prod` command.
- Firefox could not complete even a standalone browser smoke check because this execution environment rejects its child-process sandbox setup (`/proc/self/uid_map: EPERM`). WebKit could not launch because system libraries are missing. These engines are configured in CI but are **not validated here**.
- Every local benchmark sample checks row text/count/classes/icons and retained DOM identity; selection and removal handlers are also exercised.

## Local rendering comparison

Headless Chromium **153.0.8010.0**, AMD EPYC 9V74 80-Core Processor, shared Linux execution host. Preact **10.29.8**, Vue **3.5.43**. **15 retained samples per operation/library**, 3 discarded full warmup rounds, plus per-operation warmups. Library order rotates.

Median milliseconds, DOM commit plus forced layout; lower is better. Data generation, loading, parsing, validation and paint are excluded. These are local render-function adapters, **not official benchmark scores or a general library ranking**. Vue uses the production runtime without its template compiler; Preact uses its production `h`/`render` API. The handwritten DOM reference uses a simple keyed implementation, not the optimized upstream vanilla entry.

| Operation | FreshJS | Preact | Vue | DOM reference |
| --- | ---: | ---: | ---: | ---: |
| Create 1,000 | 45.7 | 51.4 | 43.2 | 49.5 |
| Create 10,000 | 542.4 | 523.1 | 469.3 | 566.5 |
| Replace 1,000 | 40.9 | 45.4 | 56.0 | 44.7 |
| Update every tenth | 5.9 | 6.5 | 7.0 | 6.1 |
| Update one | 6.0 | 7.4 | 4.9 | 4.8 |
| Select | 1.7 | 3.2 | 2.0 | 1.0 |
| Swap distant rows | 5.1 | 6.6 | 5.5 | 40.0 |
| Remove one | 4.9 | 6.1 | 5.2 | 4.0 |
| Append 1,000 | 44.9 | 52.5 | 42.4 | 43.4 |
| Shrink to 10 | 6.5 | 5.8 | 6.9 | 5.0 |
| Clear | 5.4 | 5.5 | 6.0 | 5.6 |
| Unchanged refresh | 1.0 | 2.6 | 2.0 | 0.6 |

The measured strengths are unchanged refreshes, row selection and reordering; large initial mounts remain a useful optimization target. Differences near the sample spread should not drive design decisions. A second machine/browser run is needed before making broad performance claims.

Raw distributions and provenance: [results-2026-09-24.json](results-2026-09-24.json). For example, FreshJS swap samples have a median of 5.1 ms after reconciliation was corrected; the preliminary three-sample prototype measured 44.1 ms while moving intervening rows. That exploratory before/after comparison is not a controlled release benchmark.

## Runtime size

| Runtime | Raw bytes | Gzip bytes | Brotli bytes |
| --- | ---: | ---: | ---: |
| Original FreshJS | 9,219 | 2,322 | 2,020 |
| Updated FreshJS | 12,318 | 3,327 | 2,859 |
| Preact production ESM | 11,693 | 4,834 | 4,416 |
| Vue production runtime ESM | 111,433 | 41,895 | 37,681 |

FreshJS remains unminified. The fixes and features add **1,005 gzip bytes** (+43% over its very small baseline); raw source increases by 3,099 bytes. These are complete runtime file sizes, not like-for-like application bundle measurements. Compression uses gzip level 9 and Brotli quality 11.

## First versus cached FreshJS template

Median milliseconds for construction, attach, refresh and forced layout. A separate two-column keyed table, 15 first/cached pairs per size, fixed pair order. This illustrates compile-once behavior; it does not isolate JIT effects or measure page startup.

| Rows | First template | Cached template |
| --- | ---: | ---: |
| 0 | 0.4 | 0.2 |
| 100 | 1.8 | 1.5 |
| 1,000 | 16.0 | 14.3 |

Raw samples: [mount-2026-09-24.json](mount-2026-09-24.json).

## Boundaries and next work

- The template evaluator still requires `unsafe-eval`; strict CSP support would need a separate design decision.
- Register child components before parent construction. Late registration, lexical nested-loop scope and general iterables are not added.
- The complete upstream CPU/memory/startup/size suite has not been run, and no entry has been submitted upstream. The supported export and instructions are in [README.md](README.md).
- Inspect large-table allocation/creation costs next, then measure another engine and realistic application workloads before adding more runtime machinery.
