# V1 verification record

The implementation follows the authoritative refinement in `goal.txt` section 0.
This is the engineering preview defined there; educational review and production
release checks are separately tracked below. No V2/V3 capability is represented
as complete or exposed as a working control.

## Evidence by requirement

| Specification | Implementation and verification |
| --- | --- |
| 0.1; 1–3; 19: static, parent-led bilingual V1 | Vite, vanilla ES modules, separate UI dictionaries, no runtime packages/backend. Home defaults and new/continue flows exercised in browser tests. All commands in `package.json`; lockfile and Node 24 pin present. |
| 0.2; 4; 11; 25: 100 words per language, independent curricula, authored splits | `src/data/v1/{en,fr,curriculum-en,curriculum-fr}.json`; build-time validator confirms 200 entries, five populated units per language, NFC spelling, IDs/ranks/orders/units, annotation reconstruction, silent-letter notes and optional assets. All review states remain draft. Semantic review is not claimed. |
| 5–6: modes, hint/front/back, meaning, casing, silent letters | Reader browser tests verify hint visibility, explicit reveal, contextual sentence, reset on navigation, uppercase accents and mode continuity. Unit tests preserve title-case spelling across segments and identify silent letters. No heuristic splitting or automatic audio exists. |
| 7–8: calm mermaid theme, day/night, configurable Home | Local SVG kingdom art and logo; CSS theme tokens; language/mode/goals/filters/order/case controls, collapsed advanced settings, empty-filter disabling and seed-zero entry tested. Saved adventure follows language selection. Desktop/phone screenshots inspected. |
| 0.3; 12: reproducible decks | Independent committed ordering ranks; intersection filters; stable learning sort; Mulberry32/Fisher–Yates; PRNG vector and exact seed-zero permutation unit tests. `v1` is an explicit route version; unsupported versions reject rather than silently replay another deck. |
| 0.4; 9: round boundaries and completion | Tests cover Previous/Next, unique visits on repeated cards, completion reload, early finish without completion, next round, final short round and restart. Position and full deck identity stay in copied links; remote visits are not invented. |
| 10: directory and standalone isolation | All 100 entries per language listed; language/unit/sort filters; accent-insensitive search; direct-card refresh; directory filter restoration, and unchanged session snapshots tested. |
| 0.5; 13: canonical links and browser history | Parser/serializer round trips across language/mode/order/case/goal combinations, strict invalid-state tests, Browser Back/Forward/reload, clipboard fallback and fresh-context exact replay. Foreign-host links are parsed locally. Duplicate known query fields, overflow indices, unsafe schemes and inputs over 4096 characters reject. |
| 0.4–0.5; 14; 22: local persistence and recovery | Schema-versioned key and deck snapshots; isolated language/mode/config identities and bounded storage. Unit tests cover bad snapshots, JSON/schema errors, denied/quota storage and repeated visits. Browser tests cover corruption/denial, local continuation and malformed URLs preserving existing sessions. |
| 7.5; 23: accessibility | Axe checks Home, reader, back, directory in both themes and completion/error views; no violations of the tested WCAG A/AA rules. Keyboard activation, reduced motion, language metadata, 390×844 phone / 768×1024 tablet layouts, long words, and 200% text at 320px tested. This is not formal WCAG certification. |
| 0.6; 20: offline and PWA | Manifest and actual 192/512px PNG/maskable icons included. Generated worker precaches all production files and waits before updates. Browser test waits for worker control, disables network, reloads a deep session link, advances and opens a directory card offline. No external runtime requests observed. |
| 21: Cloudflare-ready artifact | `dist/` builds successfully. Explicit route rewrites, real 404 page and self-only security headers included. README documents Git-integrated Pages build/output/Node settings. Hosted behavior is a separate check below. |
| 24; 27–28: performance and usable reading flow | Main production JS includes the entire 200-entry library and is about 20 KB gzipped; CSS about 5 KB gzipped. Cards need no per-card fetch. The default parent/child flow, pause/resume and ten-word goal are implemented; no timer, grade, account or rewards requirement interrupts it. |

## Automated commands

- `npm run validate:content`: passes, 100 English + 100 French, all marked draft.
- `npm test`: 34 tests pass.
- `npm run build`: passes and emits the production precache worker.
- `npm run test:e2e`: 23 Chromium browser tests pass against production preview.
- Dependency installation audit after patched tool versions: zero reported advisories.

Validation environment: Node 26.10.0, Playwright 1.64.1, Chromium 156 on Linux.
Node 24 LTS is the supported deployment pin and is within installed tools' stated
engine ranges. Automated tests were not run on a physical tablet/phone or Safari.
Browser screenshots/traces are generated under ignored `test-results/`.

## Separate release checks still open

- Actual educator review and provenance for all 200 entries and both curricula;
  see `content-review.md`. Automated validation cannot replace it.
- Parent/child observation on physical phones and tablets, including bedtime use,
  iOS/Safari and Android installation, pronunciation and readability feedback.
- Cloudflare Pages publication and checks on the deployed HTTPS origin: direct
  route refreshes, true 404 for missing JS/images, security headers, installability,
  offline startup after caching, and a service-worker update with a live session.

No Cloudflare deployment or human review was performed during local implementation.
