# Pearl Readers

A calm, parent-led French and English reading adventure. Static Vite application,
vanilla JavaScript, local JSON content, no accounts, backend, analytics, or runtime
third-party requests. The refined V1 contract is in [goal.txt](goal.txt), section 0.

**Content status:** engineering preview. All 200 entries have explicitly authored
spelling groups and examples, and pass structural validation. All remain `draft`;
no educator review or instructional effectiveness is claimed. Read with a parent
and use the family's pronunciation. See [content review](docs/content-review.md).

## Run

Use Node 24 LTS (`nvm use` with `.nvmrc`), then:

```sh
npm ci
npm run dev
```

Open the Local URL Vite prints (normally `http://127.0.0.1:5173`). Defaults are
French, Sound Explorer, night, lowercase, learning order, and ten words per round.
Home remembers configuration; **Continue** opens a saved adventure, while **Start
new adventure** starts that configuration at its beginning. English/French,
mode, deck, filter, order, seed, and goal identify separate saved adventures.

Sound Explorer shows authored spelling groups. Word Explorer offers an optional
hint. Dotted underlines identify silent letters, with a parent explanation. Card
backs reveal a contextual example. Flipping does not advance or grade the child.
No word illustrations or audio are required in this release.

## Build and verify

```sh
npm run validate:content
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run preview
```

`npm run build` fails on invalid content and generates `dist/sw.js` from the actual
built asset list. Browser tests use the production preview server on port 4173,
including the real service worker; they require `dist/` to exist. Playwright
starts/stops that server automatically. Install host browser dependencies if your
OS needs them (`npx playwright install --with-deps chromium`). For an existing
browser, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Standard Playwright's
`PLAYWRIGHT_BROWSERS_PATH` is supported too. Test reports/traces live in ignored
`test-results/` and `playwright-report/`.

## Reproducible links and local progress

- `/words?lang=fr&sort=alpha&q=etoile&unit=fr-05` searches the directory without
  altering an adventure. Accent-insensitive search preserves displayed spelling.
- `/card?deck=v1&lang=fr&id=fr-chat` opens a standalone card.
- `/play?deck=v1&lang=fr&mode=simple&order=learn&case=lower&min=1&max=5&goal=10&s=0&i=4`
  restores a round, including its start and exact current word.
- Shuffle adds `seed=0` (valid unsigned 32-bit range: 0–4294967295). Optional
  `unit` intersects the inclusive `min`/`max` difficulty filter.

All replay fields are copied by **Copy this adventure**. Home can import a full
HTTP(S) adventure URL from any host or a relative `/play` link; it only parses
its state and never fetches the pasted host. Invalid present fields are rejected.
Clipboard denial exposes a selectable link. Theme is device-local; card case is
part of the adventure link. Browser Back/Forward follows card changes.

An adventure contains the full filtered deck. A round reads at most 5, 10, 15, or
20 consecutive cards; the final round may be shorter. Finishing records completion
once and **Continue reading** starts at the next unread slice. Early finish saves
the current position without reporting a completed round. Unique local visits
are reported separately from mastery. A link imports position/configuration, not
the source device's private visit or completion history.

Storage key `pearl-readers:v1` carries schema 1, preferences, ordered deck-ID
snapshots, round visits/completion and at most 20 recently used identities.
Storage denial, quota errors, corruption or unsupported schemas leave reading
available in memory with a visible notice. Nothing calls `localStorage.clear()`.
Local progress is not synchronized and can be lost if browser data is cleared.

The committed `src/data/v1/` bundle defines vocabulary, curriculum and ordering.
Learning order is unit sequence, difficulty, unit order, stable ID. Alphabetical
order uses committed ranks authored with language-specific collation, so browser
ICU differences cannot change replay. Shuffle is Mulberry32 + Fisher–Yates on
learning order. Golden tests lock the PRNG and a seed-zero permutation. After
publishing this bundle, retain it unchanged when adding future bundles; old links
must resolve the old manifest or explicitly report an unsupported version.

## Offline and installation

Use `npm run build` / `npm run preview` to test offline support (the development
server intentionally does not register a worker). HTTPS is required in production;
localhost is allowed for development. Wait for the **Ready for offline reading**
footer status before disconnecting. The shell, full bilingual datasets and all
local art/icons are precached. Reader, card, Home and directory deep links then
work without a network connection. Browser storage eviction can remove caches.

A manifest, 192/512px icons, separate maskable icon and standalone display support
installation via the browser's installation UI. Installation availability varies
by browser. New service workers wait for existing tabs to close; they do not force
an active round onto a new build. Old named caches are removed on activation.
The generated worker caches known routes/assets only, not arbitrary missing URLs.

The SVG logo and kingdom illustration are repository-native assets. To rebuild
PNG installation icons after editing the logo, install a Playwright browser and
run `node scripts/generate-icons.js`. Generated PNGs are committed source assets.

## Cloudflare Pages

Connect this repository using Pages Git integration (no Worker, database, or
secret is needed):

| Setting          | Value                          |
| ---------------- | ------------------------------ |
| Framework preset | None                           |
| Build command    | `npm run build`                |
| Output directory | `dist`                         |
| Node version     | `24` (also pinned in `.nvmrc`) |

The [Cloudflare serving documentation](https://developers.cloudflare.com/pages/configuration/serving-pages/)
describes Pages routing. `public/_redirects` provides explicit rewrites for `/play`,
`/card` and `/words`; a top-level `404.html` prevents implicit catch-all SPA
fallback. Missing assets consequently remain missing rather than returning HTML.
`public/_headers` sets a self-only CSP, disables camera/mic/location, and avoids
long-lived caching of the worker and HTML. No third-party fonts or CDNs are used.

After deploying, check direct requests and refreshes for all four app routes;
verify `/missing.js` returns 404, MIME types, security headers, and offline reload
on the actual HTTPS origin. These hosted checks have not been run without a
Cloudflare deployment. Local Vite preview tests validate app routing and offline
behavior, not Cloudflare's redirect/header interpreter.

## Structure and boundaries

`src/content.js` loads the immutable bundle and applies presentation casing.
`deck.js` owns filtering, ordering, identity and round rules; `router.js` validates
and serializes routes; `storage.js` owns resilient persistence; `i18n.js` contains
independent UI dictionaries. `main.js` renders the Home, reader, directory,
standalone card, error and completion views. CSS tokens define accessible day
and night palettes. Tests cover domain invariants and integrated interactions.

V2 review queues, audio, word families, reading sentences, and V3 colouring-page
rewards are deliberately deferred per the spec. No placeholder controls are shown.
Educator review, parent/child testing on real devices, actual installation on iOS/
Android, and hosted production verification remain separate release checks.
