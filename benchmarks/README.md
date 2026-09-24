# Benchmarks

There are two distinct benchmark paths. The local comparison is useful for development;
its numbers are **not official js-framework-benchmark scores**.
See [RESULTS.md](RESULTS.md) for the measured 2026-09-24 snapshot and validation status.

## Local comparison

```sh
npm ci
npx playwright install chromium
npm run benchmark
npm run size
```

Optional settings: `SAMPLES=30 WARMUPS=3 LIBRARIES=fresh,preact,vue,vanilla npm run benchmark`.
For an installed Chromium binary set `CHROMIUM_PATH=/path/to/chrome`. Windows users can
set these environment variables using their shell's syntax. No runtime build is performed.
The optional `npm run serve` serves `/benchmarks/?library=fresh` for inspection.

The runner uses pinned Preact and Vue **production** browser ES modules from node_modules;
there are no CDN requests. FreshJS uses its checked-in, unminified source. Preact uses
`h`/`render`, Vue uses its runtime `h`/`render` API without a template compiler, and
vanilla is a handwritten keyed DOM reference. These compare whole-table rendering APIs,
not memoized row components, Vue compiler output, application reactivity, or every way to
use these libraries. All use stable row IDs, the same data, shadow roots, table structure,
CSS, per-row event handlers, and selected-row state. Each page imports only its own library.
The vanilla implementation is a simple reference, not the upstream optimized vanilla entry.

Measured workloads: create 1,000/10,000 rows, replace 1,000, update every tenth row,
update one row, select, swap rows 1 and 998 (zero-based), remove, append 1,000, shrink,
clear, and unchanged refresh. The runner verifies text, classes, counts, icons, keyed
DOM identity, and selection/removal handlers. Incorrect output aborts the run.

`results.local.json` contains every sample plus browser, runtime, OS, CPU, revisions,
launch flags, library versions and sample counts. It reports:

- `domMs`: state mutation through completed DOM commit (including awaited microtasks).
- `layoutMs`: the same interval plus a forced layout through `offsetHeight`.

Data generation, setup, verification, network loading, JavaScript parsing and paint are
excluded. The harness waits for a frame before starting; it does not measure display
latency or claim that a frame has been painted. Setup renders 1,000 rows for updates.
Each operation has an untimed warmup in each page; full warmup rounds are also discarded.
Library order rotates between rounds. Every library gets a fresh page each round.
No outliers are discarded. Runtime sizes use raw bytes, gzip level 9, and Brotli quality 11;
these are runtime-only files, not app payloads. Compression is optional server delivery,
not a required developer build step.

For stable decisions, run on an otherwise idle machine, repeat with another browser and
inspect the raw distributions. Shared-host headless results are directional, not universal
rankings. Memory/GC, cold network startup, paint, mobile hardware, and application-scale
workloads require separate measurements.

`npm run benchmark:mount` separately measures FreshJS first-template construction versus
cached-template construction for 0, 100, and 1,000 rows. This includes DOM creation and
forced layout, excludes module loading, and writes `mount.local.json`. Its fixed
first-then-cached order does not separate JIT/order effects; it is not a cold page startup score.

## Standard js-framework-benchmark implementation

The [upstream suite](https://github.com/krausest/js-framework-benchmark) defines the DOM,
button IDs, keyed identity, and CPU/memory/startup/size tests. FreshJS now has the keyed
list feature needed for its keyed table entry. The implementation uses ordinary FreshJS
bindings, all standard table operations, the upstream stylesheet, and declared shadow-root
metadata; it has no manual DOM manipulation or application event delegation.

From this repository:

```sh
git clone https://github.com/krausest/js-framework-benchmark.git ../js-framework-benchmark
node benchmarks/export-standard.mjs ../js-framework-benchmark
```

The export creates `frameworks/keyed/freshjs` with a copy of the current runtime and
standalone native modules. It refuses to overwrite an existing directory; remove or move
your previous exported copy deliberately before exporting again. The export is a snapshot,
so re-export after runtime changes.

Follow the upstream README for its toolchain. A minimal correctness check is:

```sh
cd ../js-framework-benchmark/frameworks/keyed/freshjs
npm install
npm run build-prod
cd ../../../..
npm ci
npm run install-webdriver-ts
npm start
# In another terminal, from the upstream repository:
cd webdriver-ts
npm run isKeyed -- keyed/freshjs --headless --chromeBinary /path/to/chrome
```

`build-prod` is intentionally a no-op: the application already runs directly as ES modules.
For official-style timing, use the upstream driver and its baseline implementations on the
same machine, e.g. from its root:

```sh
npm run bench -- --framework keyed/freshjs keyed/preact keyed/vue --chromeBinary /path/to/chrome
```

Build the chosen baselines first following the upstream instructions. A full suite run can
be lengthy. Passing `isKeyed` validates its structural/keyed tests, not the complete CPU,
memory, startup, CSP, and release submission gates. The exported table still uses string expressions and requires `unsafe-eval`; it will
not pass the upstream no-eval CSP check. The separate `fresh-csp.js` entry point and
callback demo support no-eval CSP, but that table adapter has not been converted. No benchmark entry has been submitted upstream.


## Comparing a runtime change with the previous revision

```sh
node benchmarks/prepare-baseline.mjs b067bfd
LIBRARIES=fresh-before,fresh SAMPLES=9 WARMUPS=2 npm run benchmark
```

The helper materializes the selected historical standalone runtime/table adapter under
an ignored `.baseline` directory. The default baseline is the first fixes commit. Every
page imports only the version under measurement; validation and rotated ordering are
unchanged. Retain the JSON output, which includes source hashes for the working runtime.
This baseline helper expects a revision with standalone `fresh.js` and the table adapter.
See [USABILITY-RESULTS.md](USABILITY-RESULTS.md) for the current feature-change report.
