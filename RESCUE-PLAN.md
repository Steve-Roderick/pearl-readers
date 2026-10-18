# Rescue stories and pearl necklace

Status: implemented. The sections below record the agreed behavior and release checks.

## Experience

Read a set together → watch one bubble per completed word → enjoy a complete
rescue story → receive an illustrated animal pearl → visit the necklace.

Home explains the game briefly instead of presenting a rescue that appears to
depend on future gameplay. Suggested copy: “Read together. Rescue ocean friends.
Grow your pearl necklace.” Retain easy access to settings and saved reading.

## Stories and illustrations

- Rewrite the ten existing stories and add ten, in English and French.
- Each story has a different sea creature and roughly the existing length:
  three short paragraphs, about 65–90 English words, with natural French length.
- Every story contains the problem, Pearl's brave action using reading and
  magical bubble patterns, and a definite happy resolution. End with the animal
  safe, without asking the child to perform a rescue that is already over.
- Keep the existing turtle, seahorse, octopus, ray, crab, dolphin, jellyfish,
  seal, whale, and starfish. Add a sea otter, penguin, lobster, squid, pufferfish,
  clownfish, sea snail, shrimp, hermit crab, and small shark.
- Give every creature an original, cohesive illustration that fits inside an
  iridescent bubble stamp. Use local SVG artwork so the stamps remain sharp,
  small, and available offline. Show the same artwork in the story and necklace.
- Review both languages for complete endings, gentle stakes, and read-aloud
  clarity. Do not imply the stories match the flashcard phonics difficulty.

## Completion screen

1. Emit exactly one bubble per word completed in this set, with a visible total.
2. Reveal the complete rescue story in large text with its animal illustration.
3. Show the animal bubble stamp joining the necklace.
4. Offer “See my necklace” and “Read another set”, plus the existing home route.

The app cannot assess spoken answers. Count distinct cards advanced through
within a set as words read together, not verified correct answers. Merely
loading a card is not enough to earn a word. The final Finish action counts the
last card. Revisiting cards within the same set does not increase its count.
Use the actual number of cards in a short final set, not the configured goal.

Stopping early saves the reading position and completed-card IDs, without
awarding a rescue. Resume the same set later. A standalone library card does
not complete a set or award a rescue.

## Necklace page

- Add `/necklace`, with a compact pearl-necklace link in the header and a clear
  accessible name. Keep phone navigation and the title readable.
- Display a curved strand with illustrated animal beads in earned order and a
  few subtle empty pearl outlines. Keep the empty state inviting.
- Display total completed words, total rescues, and unique animal types.
- Selecting an earned bead opens its story again in the current language.
- Award animals without repeats during each group of twenty rescues. After
  twenty, begin another strand, allowing familiar animals to return. Every
  completed set still earns a bead. Allow navigation between older strands.
- On entry, emit one bubble per lifetime earned word in overlapping waves.
  Use a bounded particle pool and a running count rather than creating one DOM
  node per lifetime word. Start promptly, keep controls usable, stop animation
  when leaving the page, and provide a way to skip a long celebration.
- Reduced motion shows static bubbles and the same totals and stories.

## Durable reward rules

- Generate and persist a unique attempt ID when a new set starts. Continuing or
  reloading retains it; deliberately starting another set creates a new one.
- Persist an immutable receipt containing attempt ID, animal/story ID, actual
  completed-word count, reading language, and completion time.
- Completion checks and writes the receipt once. Refresh, Back/Forward, repeated
  clicks, language/case changes, and reopening completion must not duplicate it.
- Changing reading language preserves earned rewards and resumes/starts the
  appropriate reading attempt; it does not mark the other attempt completed.
- Explicit repeated practice earns another receipt even for familiar words.
- Keep receipts outside the twenty-session retention limit. Switching settings,
  restarting a deck, or pruning recent sessions must not remove earned beads.
- Reload the latest saved reward state before awarding and reconcile receipts
  by attempt ID if multiple tabs update progress. Never overwrite a newer
  collection with an older in-memory copy.
- Save locally without accounts. Explain that another device/browser, private
  browsing, or clearing site data does not retain this collection. Shared
  adventure links carry reading settings, not rewards.
- Preserve existing preferences and reading positions. Begin rewards with this
  release: existing retained visits cannot prove a lifetime earned-word total.
- If saving fails, keep this visit usable and clearly explain that progress
  cannot be retained; do not display a false saved confirmation.

## Implementation order

1. Add the attempt/receipt model and storage migration in `src/storage.js`, with
   meaningful unit coverage for award-once behavior, replay, partial sets,
   short final sets, retention, and malformed stored data.
2. Update reading actions in `src/main.js` to record completed cards separately
   from visits and to preserve unfinished attempts. Keep existing reading links
   compatible.
3. Expand `src/data/stories.json` to twenty complete bilingual stories, add
   creature metadata/artwork, and validate stable unique IDs and translations.
4. Replace the home carousel and completion screen, then add the necklace view,
   route handling in `src/router.js`, and English/French copy in `src/i18n.js`.
5. Add responsive necklace layout, stamps, word bubbles, and reduced motion.
6. Add `/necklace` to `public/_redirects` and the navigation routes handled by
   `scripts/build-offline.js`. Ensure artwork is included in precaching.

## Acceptance and release checks

- Five-, ten-, fifteen-, and twenty-card rounds award their actual word count,
  one matching bubble per word, one complete story, and one illustrated bead.
- A short last round, interrupted round, repeated practice, library visit,
  completion reload, browser history navigation, and language switch follow the
  reward rules above. Collection survives session pruning and app updates.
- All twenty stories have English/French problem and solution text, matching
  artwork, and a happy ending. The first twenty awards contain no duplicates;
  the twenty-first starts another strand.
- Necklace totals match receipts, previous stories can be reopened, large totals
  animate without unbounded nodes, and leaving the page cancels animation.
- Empty and populated necklaces work on a narrow phone and desktop with keyboard,
  screen-reader labels, both themes/languages, and reduced motion.
- After precaching, reading, earning, necklace navigation, illustrations, and
  deep-link reload all work offline. A fresh `/necklace` load works on Pages;
  nonexistent assets still return 404.
- Run unit/content checks, production build, and relevant browser regressions.
  Inspect the rendered necklace and completion screen before deploying trunk.
  Repeat live route and offline checks after deployment.

Implementation lives in `src/storage.js`, `src/rescue.js`, and the existing reading
views. The automated checks cover storage migration, completion/replay, multiple
tabs, all round sizes, twenty-one rescues, offline use, accessibility, and phone
layouts. `README.md` documents storage and deployment details.
