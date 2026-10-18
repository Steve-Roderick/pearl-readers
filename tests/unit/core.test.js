import { describe, it, expect } from "vitest";
import {
  words,
  displayCase,
  displaySegments,
  searchKey,
} from "../../src/content.js";
import {
  defaults,
  buildDeck,
  mulberry32,
  roundEnd,
  nextRound,
  sessionKey,
} from "../../src/deck.js";
import {
  parseRoute,
  sessionURL,
  parseAdventureLink,
  cardURL,
  directoryURL,
} from "../../src/router.js";
import { createStorage } from "../../src/storage.js";
import {
  readContent,
  validateContent,
} from "../../scripts/validate-content.js";
const c = { ...defaults };
const memory = () => {
  let value = null;
  return {
    getItem: () => value,
    setItem: (_, v) => {
      value = v;
    },
  };
};

describe("authored bilingual content", () => {
  it("has exactly 100 reconstructable entries and five covered units per language", () => {
    const { libraries, units } = readContent();
    expect(validateContent(libraries, units)).toEqual([]);
  });
  it("rejects broken educational records and false review claims", () => {
    const { libraries, units } = readContent();
    libraries.fr[0].decoding.segments[0].text = "bad";
    libraries.en[1].id = libraries.en[0].id;
    libraries.en[2].review = { status: "educator-reviewed" };
    libraries.fr[3].image = "/images/missing.webp";
    const errors = validateContent(libraries, units).join("\n");
    expect(errors).toContain("reconstruct");
    expect(errors).toContain("duplicate ID");
    expect(errors).toContain("review provenance");
    expect(errors).toContain("asset");
  });
  it("preserves accents and segments in all three cases", () => {
    expect(displayCase("étoile", "upper", "fr")).toBe("ÉTOILE");
    expect(displayCase("étoile", "title", "fr")).toBe("Étoile");
    const word = words.fr.find((w) => w.word === "étoile");
    expect(
      displaySegments(word, "title")
        .map((s) => s.text)
        .join(""),
    ).toBe("Étoile");
    expect(searchKey("ÉTOILE")).toBe("etoile");
    expect(word.decoding.segments.at(-1).spoken).toBe(false);
  });
});
describe("immutable deck engine", () => {
  it("has fixed learning and committed alphabetical ordering", () => {
    expect(
      buildDeck(c)
        .slice(0, 4)
        .map((w) => w.word),
    ).toEqual(["ami", "mamie", "papi", "papa"]);
    const alpha = buildDeck({ ...c, order: "alpha" });
    expect(alpha.map((w) => w.alphabeticalRank)).toEqual(
      Array.from({ length: 100 }, (_, i) => i + 1),
    );
  });
  it("uses intersection filters without changing the source array", () => {
    expect(buildDeck({ ...c, min: 2, max: 3, unit: "fr-02" })).toHaveLength(20);
    expect(buildDeck({ ...c, min: 1, max: 1, unit: "fr-02" })).toHaveLength(0);
    expect(words.fr[0].word).toBe("ami");
  });
  it("locks Mulberry32 seed zero to a known vector", () => {
    const r = mulberry32(0);
    expect([r(), r(), r()]).toEqual([
      0.26642920868471265, 0.0003297457005828619, 0.2232720274478197,
    ]);
  });
  it("locks a published shuffle permutation and produces no duplicates", () => {
    const shuffled = buildDeck({
      ...c,
      lang: "en",
      order: "shuffle",
      min: 1,
      max: 1,
      seed: 0,
    });
    expect(shuffled.map((w) => w.id)).toEqual([
      "en-fan",
      "en-bat",
      "en-mat",
      "en-hat",
      "en-map",
      "en-mad",
      "en-bag",
      "en-ham",
      "en-rag",
      "en-sad",
      "en-man",
      "en-wag",
      "en-van",
      "en-jam",
      "en-cap",
      "en-can",
      "en-sat",
      "en-tap",
      "en-cat",
      "en-pan",
    ]);
    expect(new Set(shuffled.map((w) => w.id)).size).toBe(20);
    expect(buildDeck({ ...c, order: "shuffle", seed: 0 })).toEqual(
      buildDeck({ ...c, order: "shuffle", seed: 0 }),
    );
  });
  it("bounds short/final rounds and never wraps within a round", () => {
    expect(roundEnd({ ...c, s: 98 }, 100)).toBe(100);
    expect(nextRound({ ...c, s: 90 }, 100)).toMatchObject({ s: 0, i: 0 });
    expect(nextRound(c, 100)).toMatchObject({ s: 10, i: 10 });
    expect(sessionKey(c)).toBe(sessionKey({ ...c, case: "upper", seed: 19 }));
    expect(sessionKey(c)).not.toBe(sessionKey({ ...c, lang: "en" }));
  });
});
describe("URL contract", () => {
  it("round-trips every language, mode, order, goal and case combination", () => {
    for (const lang of ["fr", "en"])
      for (const mode of ["simple", "normal"])
        for (const order of ["learn", "alpha", "shuffle"])
          for (const goal of [5, 10, 15, 20])
            for (const letterCase of ["lower", "upper", "title"]) {
              const config = {
                ...c,
                lang,
                mode,
                order,
                goal,
                case: letterCase,
                s: 20,
                i: 22,
                seed: 0,
              };
              expect(parseRoute(sessionURL(config))).toEqual({
                view: "play",
                config,
              });
            }
  });
  it("uses defaults only for absent fields", () => {
    expect(parseRoute("/play").config).toEqual(c);
    expect(parseRoute("/play?s=20").config.i).toBe(20);
  });
  it.each([
    "lang=xx",
    "mode=",
    "case=camel",
    "seed=-1",
    "seed=4294967296",
    "seed=1.2",
    "min=0",
    "min=4&max=2",
    "goal=6",
    "s=100",
    "i=10",
    "i=-1",
    "unit=en-01",
    "deck=v2",
    "i=9007199254740992",
    "i=1&i=2",
    "min=1&max=1&unit=fr-02",
  ])("rejects malformed state: %s", (query) => {
    expect(() => parseRoute("/play?" + query)).toThrow();
  });
  it("parses foreign-host links locally and rejects short codes/unsafe schemes", () => {
    expect(parseAdventureLink("https://example.org/play?seed=0").seed).toBe(0);
    for (const input of [
      "123",
      "javascript:alert(1)",
      "//example.org/play",
      "/card?lang=en&id=en-cat",
      "/play?x=" + "a".repeat(4096),
    ])
      expect(() => parseAdventureLink(input)).toThrow();
  });
  it("serializes known routes, strips unknown fields and never resolves unknown words", () => {
    expect(parseRoute(cardURL(words.fr[0]))).toMatchObject({
      view: "card",
      id: "fr-ami",
    });
    expect(
      parseRoute(
        directoryURL({
          lang: "fr",
          sort: "difficulty",
          q: "étoile",
          unit: "fr-05",
        }),
      ),
    ).toMatchObject({ q: "étoile", unit: "fr-05" });
    expect(sessionURL(parseRoute("/play?surprise=cat").config)).not.toContain(
      "surprise",
    );
    expect(() => parseRoute("/card?lang=fr&id=missing")).toThrow();
    expect(() => parseRoute("/rewards")).toThrow();
  });
});
describe("local persistence", () => {
  it("retains visits once, separates languages and preserves completion across reload", () => {
    const backend = memory(),
      s = createStorage(() => backend);
    const deck = buildDeck(c);
    s.visit(c, deck);
    s.visit({ ...c, i: 1 }, deck);
    s.visit(c, deck);
    expect(s.last.visited).toHaveLength(2);
    s.complete(c);
    const english = { ...c, lang: "en" };
    s.visit(english, buildDeck(english));
    const restored = createStorage(() => backend);
    expect(restored.get(c).completed).toBe(true);
    expect(restored.last.config.lang).toBe("en");
    expect(restored.get(c).visited).toHaveLength(2);
  });
  it("resets visits on a new round and transfers them when mode changes", () => {
    const s = createStorage(() => memory());
    s.visit(c, buildDeck(c));
    s.transferRound(c, { ...c, mode: "normal" });
    expect(s.get({ ...c, mode: "normal" }).visited).toEqual(["fr-ami"]);
    s.visit({ ...c, s: 10, i: 10 }, buildDeck(c));
    expect(s.get(c).visited).toEqual(["fr-fil"]);
  });
  it("falls back in memory for denial, invalid JSON, unknown schemas and quota errors", () => {
    for (const backend of [
      {
        getItem: () => {
          throw Error("denied");
        },
        setItem: () => {
          throw Error("denied");
        },
      },
      { getItem: () => "{bad", setItem: () => {} },
      { getItem: () => '{"schema":99}', setItem: () => {} },
    ]) {
      let warnings = 0;
      const s = createStorage(
        () => backend,
        () => warnings++,
      );
      s.visit(c, buildDeck(c));
      s.visit({ ...c, i: 1 }, buildDeck(c));
      expect(s.last.config.i).toBe(1);
      expect(warnings).toBe(1);
    }
    let warnings = 0;
    const s = createStorage(
      () => ({
        getItem: () => null,
        setItem: () => {
          throw Error("quota");
        },
      }),
      () => warnings++,
    );
    s.visit(c, buildDeck(c));
    expect(s.last.config.i).toBe(0);
    expect(warnings).toBe(1);
  });
  it("discards invalid snapshots without changing surviving sessions", () => {
    const backend = memory(),
      s = createStorage(() => backend);
    s.visit(c, buildDeck(c));
    const data = JSON.parse(backend.getItem());
    data.sessions[sessionKey(c)].deckIds.reverse();
    backend.setItem("", JSON.stringify(data));
    expect(createStorage(() => backend).last).toBeNull();
  });
  it("keeps at most 20 identities and always retains the current one", () => {
    const s = createStorage(() => memory());
    for (let seed = 0; seed < 30; seed++) {
      const config = { ...c, order: "shuffle", seed };
      s.visit(config, buildDeck(config));
    }
    expect(s.sessions).toHaveLength(20);
    expect(s.last.config.seed).toBe(29);
  });
});
