import { words, curricula } from "./content.js";
export const defaults = Object.freeze({
  deck: "v1",
  lang: "fr",
  mode: "simple",
  order: "learn",
  case: "lower",
  min: 1,
  max: 5,
  goal: 10,
  s: 0,
  i: 0,
  seed: 0,
  unit: "",
});
// Mulberry32: all arithmetic is uint32; output is in [0,1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function buildDeck(config) {
  const units = Object.fromEntries(
    curricula[config.lang].map((u) => [u.id, u.sequence]),
  );
  const deck = words[config.lang].filter(
    (w) =>
      w.difficulty >= config.min &&
      w.difficulty <= config.max &&
      (!config.unit || config.unit === w.curriculumUnit),
  );
  const idOrder = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  deck.sort((a, b) =>
    config.order === "alpha"
      ? a.alphabeticalRank - b.alphabeticalRank || idOrder(a, b)
      : units[a.curriculumUnit] - units[b.curriculumUnit] ||
        a.difficulty - b.difficulty ||
        a.unitOrder - b.unitOrder ||
        idOrder(a, b),
  );
  if (config.order === "shuffle") {
    const random = mulberry32(config.seed);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }
  return deck;
}
export const roundEnd = (config, length) =>
  Math.min(config.s + config.goal, length);
export function sessionKey(c) {
  return JSON.stringify([
    c.deck,
    c.lang,
    c.mode,
    c.order,
    c.order === "shuffle" ? c.seed : null,
    c.min,
    c.max,
    c.unit,
    c.goal,
  ]);
}
export function visitRound(previous, config, deck) {
  const same =
    previous?.config.s === config.s &&
    previous?.deckIds?.join("|") === deck.map((w) => w.id).join("|");
  return {
    config: { ...config },
    deckIds: deck.map((w) => w.id),
    visited: [
      ...new Set([...(same ? previous.visited : []), deck[config.i].id]),
    ],
    completed: same && previous.completed === true,
    updatedAt: Date.now(),
  };
}
export function nextRound(config, length) {
  const start = roundEnd(config, length);
  return {
    ...config,
    s: start < length ? start : 0,
    i: start < length ? start : 0,
  };
}
