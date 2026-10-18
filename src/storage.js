import { parseRoute, sessionURL } from "./router.js";
import { defaults, sessionKey, buildDeck, visitRound } from "./deck.js";
const KEY = "pearl-readers:v1";
const fresh = () => ({
  schema: 1,
  preferences: { ...defaults, lang: "en", theme: "night" },
  sessions: {},
  lastActive: null,
});
function validPreferences(p) {
  if (!p || !["night", "day"].includes(p.theme)) return false;
  try {
    parseRoute(sessionURL({ ...p, s: 0, i: 0 }));
    return true;
  } catch {
    return false;
  }
}
export function validRecord(record, key) {
  try {
    const { config } = parseRoute(sessionURL(record.config));
    const ids = buildDeck(config).map((w) => w.id);
    return (
      sessionKey(config) === key &&
      Array.isArray(record.deckIds) &&
      JSON.stringify(record.deckIds) === JSON.stringify(ids) &&
      Array.isArray(record.visited) &&
      record.visited.length <= config.goal &&
      new Set(record.visited).size === record.visited.length &&
      record.visited.every((id) =>
        ids.slice(config.s, config.s + config.goal).includes(id),
      ) &&
      typeof record.completed === "boolean" &&
      Number.isFinite(record.updatedAt)
    );
  } catch {
    return false;
  }
}
export function createStorage(
  getStorage = () => globalThis.localStorage,
  onFailure = () => {},
) {
  let state = fresh(),
    warned = false;
  const warn = () => {
    if (!warned) {
      warned = true;
      onFailure();
    }
  };
  try {
    const raw = getStorage().getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed.schema !== 1 ||
        !parsed.sessions ||
        typeof parsed.sessions !== "object" ||
        Array.isArray(parsed.sessions)
      )
        throw Error("Storage schema");
      state = {
        ...fresh(),
        preferences: validPreferences(parsed.preferences)
          ? parsed.preferences
          : fresh().preferences,
      };
      if (!validPreferences(parsed.preferences)) warn();
      for (const [key, record] of Object.entries(parsed.sessions))
        if (validRecord(record, key)) state.sessions[key] = record;
      state.lastActive = Object.hasOwn(state.sessions, parsed.lastActive)
        ? parsed.lastActive
        : null;
      if (
        Object.keys(state.sessions).length !==
        Object.keys(parsed.sessions).length
      )
        warn();
    }
  } catch {
    warn();
  }
  function save() {
    try {
      getStorage().setItem(KEY, JSON.stringify(state));
    } catch {
      warn();
    }
  }
  return {
    get preferences() {
      return { ...state.preferences };
    },
    get sessions() {
      return Object.values(state.sessions).sort(
        (a, b) => b.updatedAt - a.updatedAt,
      );
    },
    get last() {
      return state.sessions[state.lastActive] ?? null;
    },
    get(config) {
      return state.sessions[sessionKey(config)] ?? null;
    },
    preferencesUpdate(patch) {
      state.preferences = { ...state.preferences, ...patch };
      save();
    },
    visit(config, deck) {
      const key = sessionKey(config);
      const record = visitRound(state.sessions[key], config, deck);
      state.sessions[key] = record;
      state.lastActive = key;
      for (const old of Object.keys(state.sessions)
        .filter((k) => k !== key)
        .sort(
          (a, b) => state.sessions[b].updatedAt - state.sessions[a].updatedAt,
        )
        .slice(19))
        delete state.sessions[old];
      save();
      return record;
    },
    transferRound(from, to) {
      const source = state.sessions[sessionKey(from)];
      if (source)
        state.sessions[sessionKey(to)] = {
          ...source,
          config: { ...to },
          visited: [...source.visited],
        };
      save();
    },
    complete(config) {
      const record = state.sessions[sessionKey(config)];
      if (record && record.config.s === config.s) {
        record.completed = true;
        save();
      }
    },
    restart(config) {
      delete state.sessions[sessionKey(config)];
      save();
    },
  };
}
