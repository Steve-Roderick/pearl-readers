import { it, expect } from "vitest";
import { createStorage } from "../../src/storage.js";
import { defaults, buildDeck } from "../../src/deck.js";
function memory() {
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i],
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
}
const config = { ...defaults, lang: "en", goal: 5 };
function finish(s, c = config) {
  const deck = buildDeck(c);
  for (let i = c.s; i < Math.min(c.s + c.goal, deck.length); i++) {
    const next = { ...c, i };
    s.visit(next, deck);
    s.advance(next);
  }
  return s.complete({ ...c, i: Math.min(c.s + c.goal, deck.length) - 1 });
}
it.each([5, 10, 15, 20])(
  "awards actual completed cards once for goal %i, and persists across reload",
  (goal) => {
    const backend = memory(),
      s = createStorage(() => backend),
      c = { ...config, goal };
    s.visit(c, buildDeck(c));
    expect(s.receipts).toHaveLength(0);
    expect(s.complete(c)).toBeNull();
    const r = finish(s, c);
    expect(r.wordCount).toBe(goal);
    expect(s.complete(c)).toEqual(r);
    const restored = createStorage(() => backend);
    expect(restored.receipts).toEqual([r]);
    expect(restored.get(c).completed).toBe(true);
  },
);
it("preserves unfinished work, counts no repeated cards, rejects jumping directly to the end", () => {
  const backend = memory();
  let s = createStorage(() => backend);
  const deck = buildDeck(config);
  s.visit(config, deck);
  const id = s.last.attemptId;
  s.advance(config);
  s.advance(config);
  expect(s.last.readIds).toHaveLength(1);
  s = createStorage(() => backend);
  s.visit({ ...config, i: 4 }, deck);
  expect(s.last.attemptId).toBe(id);
  s.advance({ ...config, i: 4 });
  expect(s.complete(config)).toBeNull();
  expect(s.last.readIds).toHaveLength(2);
  expect(s.receipts).toHaveLength(0);
  expect(finish(s).wordCount).toBe(5);
});
it("replays earn again, first twenty animals are unique and twenty-first starts a new strand", () => {
  const backend = memory(),
    s = createStorage(() => backend);
  for (let i = 0; i < 21; i++) {
    s.restart(config);
    finish(s);
  }
  expect(s.receipts).toHaveLength(21);
  expect(new Set(s.receipts.slice(0, 20).map((r) => r.storyId)).size).toBe(20);
  expect(s.receipts.reduce((sum, r) => sum + r.wordCount, 0)).toBe(105);
  expect(createStorage(() => backend).receipts).toHaveLength(21);
});
it("short final sets award actual size; case and mode changes keep an attempt and award once", () => {
  const s = createStorage(() => memory()),
    c = { ...config, s: 98, i: 98, goal: 10 },
    deck = buildDeck(c);
  s.visit(c, deck);
  s.advance(c);
  const changed = { ...c, mode: "normal", case: "upper" };
  s.transferRound(c, changed);
  s.visit({ ...changed, i: 99 }, deck);
  s.advance({ ...changed, i: 99 });
  expect(s.complete(changed).wordCount).toBe(2);
  expect(s.receipts).toHaveLength(1);
});
it("stale tabs cannot erase another reward through preferences or visits", () => {
  const backend = memory(),
    first = createStorage(() => backend),
    second = createStorage(() => backend);
  finish(first);
  second.preferencesUpdate({ theme: "day" });
  const fr = { ...config, lang: "fr" };
  finish(second, fr);
  expect(first.receipts).toHaveLength(2);
  expect(createStorage(() => backend).receipts).toHaveLength(2);
});
it("retains rewards beyond twenty recent sessions and ignores malformed receipts", () => {
  const backend = memory(),
    s = createStorage(() => backend);
  finish(s);
  for (let seed = 0; seed < 25; seed++) {
    const c = { ...config, order: "shuffle", seed };
    s.visit(c, buildDeck(c));
  }
  expect(s.sessions).toHaveLength(20);
  expect(s.receipts).toHaveLength(1);
  backend.setItem(
    "pearl-readers:rescue:bad-data-123",
    JSON.stringify({
      attemptId: "bad-data-123",
      wordCount: 100000,
      storyId: "missing",
    }),
  );
  expect(createStorage(() => backend).receipts).toHaveLength(1);
});
it("migrates old visits without inventing earned words or deleting reading positions", () => {
  const backend = memory(),
    s = createStorage(() => backend);
  s.visit({ ...config, i: 3 }, buildDeck(config));
  const raw = JSON.parse(backend.getItem("pearl-readers:v1"));
  raw.schema = 1;
  for (const r of Object.values(raw.sessions)) {
    delete r.attemptId;
    delete r.readIds;
    r.completed = true;
  }
  backend.setItem("pearl-readers:v1", JSON.stringify(raw));
  const migrated = createStorage(() => backend);
  expect(migrated.last.config.i).toBe(3);
  expect(migrated.last.completed).toBe(false);
  expect(migrated.receipts).toEqual([]);
  migrated.visit(migrated.last.config, buildDeck(config));
  expect(migrated.last.readIds).toEqual([]);
});
