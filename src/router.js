import { defaults, buildDeck, roundEnd } from "./deck.js";
import { curricula, findWord } from "./content.js";
export class RouteError extends Error {}
const fail = () => {
  throw new RouteError("Invalid adventure");
};
function enumValue(p, key, allowed, fallback) {
  const value = p.has(key) ? p.get(key) : fallback;
  if (!allowed.includes(value)) fail();
  return value;
}
function numberValue(p, key, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!p.has(key)) return fallback;
  const value = p.get(key);
  if (!/^\d+$/.test(value)) fail();
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) fail();
  return n;
}
export function parseRoute(input, base = "https://pearl.local") {
  if (typeof input !== "string" || input.length > 4096) fail();
  let url;
  try {
    url = new URL(input, base);
  } catch {
    fail();
  }
  if (!["https:", "http:"].includes(url.protocol)) fail();
  const p = url.searchParams;
  // Duplicate known fields are ambiguous; reject instead of choosing one.
  for (const key of [
    "deck",
    "lang",
    "mode",
    "order",
    "case",
    "min",
    "max",
    "goal",
    "s",
    "i",
    "seed",
    "unit",
    "id",
    "q",
    "sort",
    "strand",
    "rescue",
  ])
    if (p.getAll(key).length > 1) fail();
  if (url.pathname === "/") return { view: "home" };
  if (url.pathname === "/necklace") {
    const lang = enumValue(p, "lang", ["en", "fr"], "en");
    const rescue = p.get("rescue") ?? "";
    if (rescue && !/^[a-zA-Z0-9-]{8,100}$/.test(rescue)) fail();
    return {
      view: "necklace",
      lang,
      strand: numberValue(p, "strand", 0),
      rescue,
    };
  }
  if (!["/play", "/card", "/words"].includes(url.pathname)) fail();
  const lang = enumValue(p, "lang", ["en", "fr"], "fr");
  if (url.pathname === "/words") {
    const unit = p.get("unit") ?? "";
    if (unit && !curricula[lang].some((u) => u.id === unit)) fail();
    return {
      view: "words",
      lang,
      q: p.get("q") ?? "",
      sort: enumValue(p, "sort", ["alpha", "difficulty"], "alpha"),
      unit,
    };
  }
  enumValue(p, "deck", ["v1"], "v1");
  if (url.pathname === "/card") {
    const word = findWord(lang, p.get("id"));
    if (!word) fail();
    return { view: "card", lang, id: word.id, deck: "v1" };
  }
  const config = {
    ...defaults,
    lang,
    deck: "v1",
    mode: enumValue(p, "mode", ["simple", "normal"], "simple"),
    order: enumValue(p, "order", ["learn", "alpha", "shuffle"], "learn"),
    case: enumValue(p, "case", ["lower", "upper", "title"], "lower"),
    min: numberValue(p, "min", 1, 1, 5),
    max: numberValue(p, "max", 5, 1, 5),
    goal: numberValue(p, "goal", 10, 5, 20),
    s: numberValue(p, "s", 0),
    unit: p.get("unit") ?? "",
  };
  config.i = numberValue(p, "i", config.s);
  config.seed = numberValue(p, "seed", 0, 0, 4294967295);
  if (config.min > config.max || ![5, 10, 15, 20].includes(config.goal)) fail();
  if (config.unit && !curricula[lang].some((u) => u.id === config.unit)) fail();
  const deck = buildDeck(config);
  if (
    !deck.length ||
    config.s >= deck.length ||
    config.i < config.s ||
    config.i >= roundEnd(config, deck.length)
  )
    fail();
  return { view: "play", config };
}
export function sessionURL(c) {
  const p = new URLSearchParams();
  for (const key of [
    "deck",
    "lang",
    "mode",
    "order",
    "case",
    "min",
    "max",
    "goal",
    "s",
    "i",
  ])
    p.set(key, String(c[key]));
  if (c.order === "shuffle") p.set("seed", String(c.seed));
  if (c.unit) p.set("unit", c.unit);
  return `/play?${p}`;
}
export const cardURL = (word) =>
  `/card?${new URLSearchParams({ deck: "v1", lang: word.language, id: word.id })}`;
export function directoryURL(c) {
  const p = new URLSearchParams({ lang: c.lang, sort: c.sort });
  if (c.q) p.set("q", c.q);
  if (c.unit) p.set("unit", c.unit);
  return `/words?${p}`;
}
export function parseAdventureLink(text) {
  if (typeof text !== "string" || text.length > 4096) fail();
  // Clipboard text can carry invisible direction/word-break marks or HTML
  // separators from a formatted link. Remove formatting, not URL values.
  let input = text
    .replace(/[\u200B-\u200F\u2060\u2066-\u2069\uFEFF\r\n\t]/g, "")
    .trim();
  if (input.startsWith("<") && input.endsWith(">"))
    input = input.slice(1, -1).trim();
  input = input.replace(/&(?:amp|#0*38|#x0*26);/gi, "&");
  if (!/^https?:\/\//i.test(input) && !/^\/play(?:\?|$)/.test(input)) fail();
  const result = parseRoute(input);
  if (result.view !== "play") fail();
  return result.config;
}
