import { parseRoute, sessionURL } from "./router.js";
import {
  defaults,
  sessionKey,
  buildDeck,
  visitRound,
  roundEnd,
} from "./deck.js";
import stories from "./data/stories.json";
const KEY = "pearl-readers:v1";
const ATTEMPT = "pearl-readers:attempt:";
const RECEIPT = "pearl-readers:rescue:";
function newAttemptId() {
  // randomUUID is unavailable on an HTTP LAN dev host; getRandomValues works there.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const fresh = () => ({
  schema: 2,
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
const validId = (id) =>
  typeof id === "string" && /^[a-zA-Z0-9-]{8,100}$/.test(id);
const validReceipt = (r) =>
  r &&
  validId(r.attemptId) &&
  stories.some((s) => s.id === r.storyId) &&
  Number.isInteger(r.wordCount) &&
  r.wordCount > 0 &&
  r.wordCount <= 20 &&
  ["en", "fr"].includes(r.language) &&
  Number.isFinite(r.completedAt);
export function createStorage(
  getStorage = () => globalThis.localStorage,
  onFailure = () => {},
) {
  let state = fresh(),
    warned = false;
  const memory = new Map();
  const warn = () => {
    if (!warned) {
      warned = true;
      onFailure();
    }
  };
  function read(key) {
    try {
      const raw = getStorage().getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {
      warn();
    }
    return memory.get(key) ?? null;
  }
  function write(key, value) {
    memory.set(key, value);
    try {
      getStorage().setItem(key, JSON.stringify(value));
    } catch {
      warn();
    }
  }
  const parsed = read(KEY);
  if (parsed) {
    if (
      [1, 2].includes(parsed.schema) &&
      parsed.sessions &&
      typeof parsed.sessions === "object" &&
      !Array.isArray(parsed.sessions)
    ) {
      state.preferences = validPreferences(parsed.preferences)
        ? parsed.preferences
        : fresh().preferences;
      if (!validPreferences(parsed.preferences)) warn();
      for (const [key, record] of Object.entries(parsed.sessions)) {
        if (validRecord(record, key)) {
          // Old visits are not proof of completed reading. Preserve the position.
          state.sessions[key] =
            parsed.schema === 1 ? { ...record, completed: false } : record;
        } else warn();
      }
      state.lastActive = Object.hasOwn(state.sessions, parsed.lastActive)
        ? parsed.lastActive
        : null;
    } else warn();
  }
  function save() {
    write(KEY, state);
  }
  function attempt(id) {
    if (!validId(id)) return null;
    const r = read(ATTEMPT + id);
    if (
      !r?.config ||
      r.attemptId !== id ||
      !validRecord(r, sessionKey(r.config))
    )
      return null;
    const allowed = r.deckIds.slice(
      r.config.s,
      roundEnd(r.config, r.deckIds.length),
    );
    if (
      !Array.isArray(r.readIds) ||
      new Set(r.readIds).size !== r.readIds.length ||
      !r.readIds.every((id) => allowed.includes(id))
    )
      return null;
    return r;
  }
  function receipts() {
    const result = new Map();
    const accept = (key, r) => {
      if (key.startsWith(RECEIPT)) {
        if (validReceipt(r) && key === RECEIPT + r.attemptId)
          result.set(r.attemptId, r);
        else warn();
      }
    };
    for (const [key, r] of memory) accept(key, r);
    try {
      const backend = getStorage();
      for (let i = 0; i < backend.length; i++) {
        const key = backend.key(i);
        if (key?.startsWith(RECEIPT)) accept(key, read(key));
      }
    } catch {
      warn();
    }
    return [...result.values()].sort(
      (a, b) =>
        a.completedAt - b.completedAt || a.attemptId.localeCompare(b.attemptId),
    );
  }
  function persist(r) {
    r.updatedAt = Date.now();
    write(ATTEMPT + r.attemptId, r);
    const key = sessionKey(r.config);
    // Read other tabs' recent sessions before updating our own entry.
    const latest = read(KEY);
    if (latest?.schema === 2)
      for (const [k, v] of Object.entries(latest.sessions ?? {}))
        if (
          validRecord(v, k) &&
          (!state.sessions[k] || v.updatedAt > state.sessions[k].updatedAt)
        )
          state.sessions[k] = v;
    state.sessions[key] = r;
    state.lastActive = key;
    for (const old of Object.keys(state.sessions)
      .filter((k) => k !== key)
      .sort((a, b) => state.sessions[b].updatedAt - state.sessions[a].updatedAt)
      .slice(19))
      delete state.sessions[old];
    save();
    return r;
  }
  const api = {
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
    get receipts() {
      return receipts();
    },
    receipt(id) {
      const r = validId(id) && read(RECEIPT + id);
      return validReceipt(r) ? r : null;
    },
    get(config) {
      return state.sessions[sessionKey(config)] ?? null;
    },
    preferencesUpdate(patch) {
      state.preferences = { ...state.preferences, ...patch };
      save();
    },
    visit(config, deck, historyAttemptId) {
      const key = sessionKey(config);
      const latest = read(KEY);
      const matches = (r) =>
        r?.config.s === config.s &&
        JSON.stringify(r.deckIds) === JSON.stringify(deck.map((w) => w.id)) &&
        r.config.lang === config.lang;
      const previous = [
        historyAttemptId,
        latest?.sessions?.[key]?.attemptId,
        state.sessions[key]?.attemptId,
      ]
        .map(attempt)
        .find(matches);
      const same = !!previous;
      const record = visitRound(same ? previous : null, config, deck);
      record.attemptId = same ? previous.attemptId : newAttemptId();
      record.readIds = same ? [...previous.readIds] : [];
      record.completed = !!api.receipt(record.attemptId);
      return persist(record);
    },
    advance(config) {
      const previous = state.sessions[sessionKey(config)];
      const r = attempt(previous?.attemptId);
      if (!r || r.config.s !== config.s || api.receipt(r.attemptId)) return r;
      r.readIds = [...new Set([...r.readIds, r.deckIds[config.i]])];
      r.config = { ...config };
      return persist(r);
    },
    transferRound(from, to) {
      const source = state.sessions[sessionKey(from)];
      if (source)
        persist({
          ...source,
          config: { ...to },
          visited: [...source.visited],
          readIds: [...(source.readIds ?? [])],
        });
    },
    complete(config) {
      const previous = state.sessions[sessionKey(config)];
      const r = attempt(previous?.attemptId);
      if (!r || r.config.s !== config.s) return null;
      const existing = api.receipt(r.attemptId);
      if (existing) {
        r.completed = true;
        persist(r);
        return existing;
      }
      const ids = r.deckIds.slice(config.s, roundEnd(config, r.deckIds.length));
      if (!ids.every((id) => r.readIds.includes(id))) return null;
      const earned = receipts();
      const used = new Set(
        earned
          .slice(Math.floor(earned.length / stories.length) * stories.length)
          .map((r) => r.storyId),
      );
      const available = stories.filter((s) => !used.has(s.id));
      const story = available[Math.floor(Math.random() * available.length)];
      const receipt = {
        attemptId: r.attemptId,
        storyId: story.id,
        wordCount: ids.length,
        language: config.lang,
        completedAt: Math.max(
          Date.now(),
          (earned.at(-1)?.completedAt ?? 0) + 1,
        ),
      };
      // Each receipt owns its key; stale preferences/sessions cannot erase awards.
      write(RECEIPT + r.attemptId, receipt);
      r.completed = true;
      persist(r);
      return receipt;
    },
    restart(config) {
      delete state.sessions[sessionKey(config)];
      const latest = read(KEY);
      if (latest?.schema === 2 && latest.sessions) {
        for (const [key, record] of Object.entries(latest.sessions)) {
          if (
            key !== sessionKey(config) &&
            validRecord(record, key) &&
            (!state.sessions[key] ||
              record.updatedAt > state.sessions[key].updatedAt)
          )
            state.sessions[key] = record;
        }
      }
      save();
    },
  };
  return api;
}
