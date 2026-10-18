import "./styles.css";
import { translationFor } from "./translations.js";
import {
  words,
  curricula,
  findWord,
  displayCase,
  displaySegments,
  searchKey,
} from "./content.js";
import { defaults, buildDeck, roundEnd, nextRound } from "./deck.js";
import {
  parseRoute,
  sessionURL,
  cardURL,
  directoryURL,
  parseAdventureLink,
} from "./router.js";
import { createStorage } from "./storage.js";
import { messages } from "./i18n.js";
import stories from "./data/stories.json";

// Pick once per page load; settings and language changes keep the chosen story.
let storyIndex = Math.floor(Math.random() * stories.length);

const app = document.querySelector("#app");
let storageFailed = false,
  offline = "offlinePending",
  cardState = "front",
  route,
  advancedOpen = false;
let directoryReturn = "",
  currentRecord = null;
const store = createStorage(
  () => localStorage,
  () => {
    storageFailed = true;
  },
);
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const lang = () => route?.config?.lang ?? route?.lang ?? store.preferences.lang;
const t = (key) => messages[lang()][key] ?? key;
const action = (name, label, cls = "secondary", extra = "") =>
  `<button type="button" class="${cls}" data-action="${name}" ${extra}>${esc(label)}</button>`;
const link = (url, label, cls = "text-link") =>
  `<a class="${cls}" href="${esc(url)}" data-nav>${esc(label)}</a>`;
const options = (items, selected) =>
  items
    .map(
      ([value, label]) =>
        `<option value="${esc(value)}" ${String(value) === String(selected) ? "selected" : ""}>${esc(label)}</option>`,
    )
    .join("");
const select = (id, label, items, selected) =>
  `<label for="${id}">${esc(label)}<select id="${id}" name="${id}">${options(items, selected)}</select></label>`;
const unitOptions = (l) => [
  ["", t("allUnits")],
  ...curricula[l].map((u) => [u.id, `${u.sequence}. ${u.title}`]),
];
const themeIcon = () =>
  store.preferences.theme === "night"
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" stroke="currentColor" stroke-width="1.5"/></svg>';
const icon = `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M7 29C1 19 11 13 17 18c2-13 16-13 18 0 11-2 14 10 5 17H12Z" fill="currentColor"/><path d="m22 29-6-12m11 12 3-15m1 16 7-10" stroke="var(--bg)" stroke-width="1.5"/><circle cx="24" cy="34" r="7" fill="var(--cream)"/></svg>`;
function toast(text) {
  const el = document.querySelector("#notice");
  el.textContent = text;
  el.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("visible"), 6000);
}
function footer() {
  return `<footer><p class="footer-line">${icon}<span>${esc(t("footer"))}</span></p><p>${esc(t("privacy"))}</p><details><summary>${esc(t("contentTitle"))}</summary><p>${esc(t("contentNote"))}</p></details><p class="connection" id="offline-status">${esc(t(offline))}</p></footer>`;
}
function shell(body) {
  document.documentElement.lang = lang();
  document.documentElement.dataset.theme = store.preferences.theme;
  document.querySelector('meta[name="theme-color"]').content =
    store.preferences.theme === "night" ? "#102d40" : "#f8f3eb";
  document.title = `Pearl Readers · ${lang() === "fr" ? "Un mot, une perle" : "One word, one pearl"}`;
  return `<div class="page ${route.view === "play" || route.view === "card" ? "reading-page" : ""}"><header class="site-header"><a class="brand" href="/" data-nav aria-label="Pearl Readers — ${esc(t("home"))}">${icon}<span>Pearl Readers<small>${esc(t("tagline"))}</small></span></a><nav aria-label="${esc(t("actions"))}"><div class="language-switch" role="group" aria-label="${esc(t("language"))}">${action("language", "EN", "language-button", `data-language="en" lang="en" aria-label="English" title="English" aria-pressed="${lang() === "en"}"`)}${action("language", "FR", "language-button", `data-language="fr" lang="fr" aria-label="Français" title="Français" aria-pressed="${lang() === "fr"}"`)}</div><a class="nav-link" href="/words?lang=${lang()}" data-nav aria-label="${esc(t("library"))}" title="${esc(t("library"))}"><span class="nav-text">${esc(t("library"))}</span><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 5v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v14c-4-1-6 0-9 2-3-2-5-3-9-2Z"/></svg></a><button type="button" class="theme-button" data-action="theme" aria-label="${esc(t("theme"))}" title="${esc(t("theme"))}">${themeIcon()}</button></nav></header>${storageFailed ? `<p class="storage-warning" role="status">${esc(t("notSaved"))}</p>` : ""}<main id="main" tabindex="-1">${body}</main>${footer()}</div><dialog id="copy-dialog"><form method="dialog"><h2>${esc(t("manualCopy"))}</h2><textarea id="copy-link" readonly aria-label="${esc(t("manualCopy"))}"></textarea><button class="primary">${esc(t("close"))}</button></form></dialog>`;
}
function storyContent() {
  const story = stories[storyIndex][lang()];
  return `<h1 id="story-title">${esc(story.title)}</h1><div class="story-text">${story.paragraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}</div>`;
}
function storyPosition() {
  return `${t("story")} ${storyIndex + 1} / ${stories.length}`;
}
function home() {
  const c = store.preferences;
  let deck = [],
    invalid = false;
  try {
    if (
      c.min > c.max ||
      !Number.isInteger(c.seed) ||
      c.seed < 0 ||
      c.seed > 4294967295
    )
      invalid = true;
    else deck = buildDeck(c);
  } catch {
    invalid = true;
  }
  const saved =
    store.get(c) ??
    store.sessions.find(
      (record) =>
        record.config.lang === c.lang && record.config.mode === c.mode,
    ) ??
    store.last;
  return `<section class="hero story-hero" aria-labelledby="story-title"><div class="hero-copy"><div class="story-selector">${action("previous-story", "‹", "story-arrow", `aria-label="${esc(t("previousStory"))}" aria-controls="story-content"`)}<p class="story-position" role="status">${esc(storyPosition())}</p>${action("next-story", "›", "story-arrow", `aria-label="${esc(t("nextStory"))}" aria-controls="story-content"`)}</div><div id="story-content">${storyContent()}</div><a href="#adventure" class="text-link hero-link">${esc(t("begin"))} <span aria-hidden="true">↘</span></a><p class="quiet-note">${esc(t("noRush"))}</p></div><div class="hero-art"><img src="/kingdom.svg" alt="" width="600" height="460"><span class="art-caption">${esc(t(store.preferences.theme === "night" ? "night" : "day"))} · Pearl Readers</span></div></section>
  <section id="adventure" class="setup-panel" aria-labelledby="setup-title"><div class="section-heading"><div><p class="eyebrow">✧ Pearl Readers</p><h2 id="setup-title">${esc(t("setup"))}</h2><p>${esc(t("setupNote"))}</p></div><span class="shell-stamp" aria-hidden="true">${icon}</span></div>
  ${saved ? `<div class="continue-panel">${link(sessionURL(saved.config), t("continue"), "primary")}<span>${esc(saved.config.lang === "fr" ? t("french") : t("english"))} · ${esc(t("progress"))} ${saved.config.i - saved.config.s + 1} ${esc(t("of"))} ${roundEnd(saved.config, saved.deckIds.length) - saved.config.s}</span></div>` : ""}
  <form id="setup-form"><div class="setup-grid">${select(
    "lang",
    t("language"),
    [
      ["fr", t("french")],
      ["en", t("english")],
    ],
    c.lang,
  )}${select(
    "mode",
    t("mode"),
    [
      ["simple", t("simple")],
      ["normal", t("normal")],
    ],
    c.mode,
  )}${select(
    "goal",
    t("goal"),
    [5, 10, 15, 20].map((n) => [n, String(n)]),
    c.goal,
  )}</div><p class="mode-note">${esc(t(c.mode === "simple" ? "simpleNote" : "normalNote"))}</p>
  <details id="advanced" ${advancedOpen ? "open" : ""}><summary>${esc(t("advanced"))}</summary><div class="advanced-grid">${select(
    "case",
    t("letterCase"),
    [
      ["lower", t("lower")],
      ["upper", t("upper")],
      ["title", t("title")],
    ],
    c.case,
  )}${select(
    "order",
    t("order"),
    [
      ["learn", t("learn")],
      ["alpha", t("alpha")],
      ["shuffle", t("shuffle")],
    ],
    c.order,
  )}${select(
    "min",
    t("min"),
    [1, 2, 3, 4, 5].map((n) => [n, String(n)]),
    c.min,
  )}${select(
    "max",
    t("max"),
    [1, 2, 3, 4, 5].map((n) => [n, String(n)]),
    c.max,
  )}${select("unit", t("unit"), unitOptions(c.lang), c.unit)}${c.order === "shuffle" ? `<label for="seed">${esc(t("seed"))}<div class="seed-row"><input id="seed" name="seed" type="number" inputmode="numeric" min="0" max="4294967295" step="1" value="${esc(c.seed)}" required>${action("seed", t("newSeed"), "secondary")}</div></label>` : ""}</div></details>
  <div class="start-row"><p id="deck-count" class="${invalid || !deck.length ? "error-text" : ""}">${invalid ? esc(t("invalid")) : deck.length ? `${deck.length} ${esc(t("available"))}` : esc(t("empty"))}</p><button class="primary" ${invalid || !deck.length ? "disabled" : ""}>${esc(t("start"))} <span aria-hidden="true">→</span></button></div></form></section>
  <div class="home-bottom"><section class="resume-panel"><h2>${esc(t("resumeTitle"))}</h2><p>${esc(t("resumeHint"))}</p><form id="restore-form"><label class="sr-only" for="adventure-link">${esc(t("resumeTitle"))}</label><input id="adventure-link" maxlength="4096" placeholder="${esc(t("resumePlaceholder"))}" required><button class="secondary">${esc(t("restore"))}</button></form><p id="restore-error" class="error-text" role="alert"></p></section><aside class="library-invite"><span class="eyebrow">FR · EN</span><p>200 ${esc(t("count"))}</p>${link("/words?lang=" + c.lang, t("explore"))}</aside></div>`;
}
function segments(word, c) {
  const parts = displaySegments(word, c.case);
  return `<div class="decoding"><div class="segments" aria-label="${esc(t({ graphemes: "groups", syllables: "syllables", "onset-rime": "rime" }[word.decoding.kind]))}">${parts.map((p, i) => `${i ? '<span class="separator" aria-hidden="true">·</span>' : ""}<span class="segment ${p.spoken ? "" : "silent"}" ${p.spoken ? "" : `aria-label="${esc(p.text + " — " + t("silent"))}"`}>${esc(p.text)}</span>`).join("")}</div>${parts.some((p) => !p.spoken) ? `<p class="silent-note">${esc(t("silentHelp"))}</p>` : ""}</div>`;
}
function hideTranslation() {
  const flash = document.querySelector("#translation-flash");
  if (!flash) return;
  flash.hidden = true;
  flash.innerHTML = "";
  document.querySelector(".flashcard")?.classList.remove("is-translating");
  document.querySelector(".card-content")?.removeAttribute("aria-hidden");
  const button = document.querySelector('[data-action="translate"]');
  if (button) {
    button.setAttribute("aria-expanded", "false");
    button.textContent = t("translate");
  }
}
function toggleTranslation(word, letterCase) {
  if (!document.querySelector("#translation-flash").hidden) {
    hideTranslation();
    return;
  }
  const translation = translationFor(word);
  const text = displayCase(translation.text, letterCase, translation.language);
  const flash = document.querySelector("#translation-flash");
  flash.hidden = false;
  flash.innerHTML = `<p class="small-label">${esc(t(translation.language === "en" ? "english" : "french"))}</p><p class="word translation-word ${text.length > 8 ? "long-word" : ""}" lang="${translation.language}">${esc(text)}</p>`;
  document.querySelector(".flashcard").classList.add("is-translating");
  document.querySelector(".card-content").setAttribute("aria-hidden", "true");
  const button = document.querySelector('[data-action="translate"]');
  button.setAttribute("aria-expanded", "true");
  button.textContent = t("backToReadingLanguage");
}
function reader() {
  const isSession = route.view === "play";
  const c = isSession
    ? route.config
    : { ...store.preferences, lang: route.lang };
  const deck = isSession ? buildDeck(c) : [];
  const word = isSession ? deck[c.i] : findWord(route.lang, route.id);
  if (
    isSession &&
    currentRecord?.completed &&
    c.i === roundEnd(c, deck.length) - 1
  )
    return completion(c, deck);
  const total = isSession ? roundEnd(c, deck.length) - c.s : 1;
  const step = isSession ? c.i - c.s + 1 : 1;
  return `<section class="reader" aria-labelledby="reading-word"><div class="reader-top">${link(isSession ? "/" : directoryReturn || "/words?lang=" + c.lang, isSession ? t("home") : t("backLibrary"))}<span class="reader-mode">${c.lang.toUpperCase()} <span aria-hidden="true">·</span> ${esc(t(c.mode === "simple" ? "simple" : "normal"))}</span><span class="position">${isSession ? `${esc(t("progress"))} ${step} ${esc(t("of"))} ${total}` : esc(t("standalone"))}</span></div>
  ${isSession ? `<div class="pearls" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<span class="${i < step ? "lit" : ""}"></span>`).join("")}</div>` : ""}
  <article class="flashcard ${cardState === "back" ? "card-back" : ""}" data-state="${cardState}"><span class="card-corner" aria-hidden="true">✧</span><div class="card-content">${cardState === "back" ? `<p class="small-label">${esc(t("example"))}</p>` : ""}<h1 id="reading-word" class="word ${word.word.length > 8 ? "long-word" : ""}" lang="${c.lang}">${esc(displayCase(word.word, c.case, c.lang))}</h1>
  ${cardState === "back" ? `<div class="meaning"><span class="meaning-star" aria-hidden="true">✧</span><p class="example" lang="${c.lang}">${esc(word.example)}</p></div>` : c.mode === "simple" || cardState === "hint" ? segments(word, c) : ""}</div><div id="translation-flash" class="translation-flash" role="status" aria-live="polite" aria-atomic="true" hidden></div><span class="card-bottom-corner" aria-hidden="true">✧</span></article>
  <div class="reveal-controls">${c.mode === "normal" && cardState !== "back" ? action("hint", t(cardState === "hint" ? "hideHint" : "hint"), "text-button", `aria-pressed="${cardState === "hint"}"`) : ""}${action("flip", t(cardState === "back" ? "front" : "flip"), "secondary", `aria-pressed="${cardState === "back"}"`)}${action("translate", t("translate"), "secondary", 'aria-controls="translation-flash" aria-expanded="false"')}</div>
  ${isSession ? `<div class="reading-navigation">${action("previous", "← " + t("previous"), "secondary", c.i === c.s ? "disabled" : "")}${action("next", t(c.i === roundEnd(c, deck.length) - 1 ? "finish" : "next") + " →", "primary")}</div>` : ""}
  <div class="reader-secondary"><details><summary>${esc(t("actions"))}</summary><div class="reader-tools">${select(
    "reader-mode",
    t("mode"),
    [
      ["simple", t("simple")],
      ["normal", t("normal")],
    ],
    c.mode,
  )}${select(
    "reader-case",
    t("letterCase"),
    [
      ["lower", t("lower")],
      ["upper", t("upper")],
      ["title", t("title")],
    ],
    c.case,
  )}${action("copy-word", t("copyWord"))}${isSession ? action("copy-adventure", t("copyAdventure")) : ""}</div></details>${isSession ? action("pause", t("pause"), "text-button") : store.last ? link(sessionURL(store.last.config), t("backSession")) : ""}</div><details class="parent-hint"><summary>${esc(t("parentHint"))}</summary><p>${esc(t("parentTip"))}</p>${word.exceptionNote ? `<p>${esc(word.exceptionNote)}</p>` : ""}</details></section>`;
}
function completion(c, deck) {
  return `<section class="completion"><p class="eyebrow">${esc(t("goalDone"))}</p><div class="completion-pearl" aria-hidden="true">${icon}</div><h1>${esc(t("doneTitle"))}</h1><p class="intro">${esc(t("doneNote"))}</p><p class="visited-count"><strong>${currentRecord.visited.length}</strong> ${esc(t("visited"))}</p><div class="completion-actions">${action("continue-deck", t(roundEnd(c, deck.length) < deck.length ? "continueDeck" : "again"), "primary")}${link("/", t("homeButton"), "secondary")}${action("copy-adventure", t("copyAdventure"), "text-button")}</div></section>`;
}
function directory() {
  return `<section class="directory"><p class="eyebrow">FR · EN / Pearl Readers</p><h1>${esc(t("directoryTitle"))}</h1><p class="intro">${esc(t("directoryNote"))}</p><form id="directory-form" class="directory-filters">${select(
    "directory-lang",
    t("language"),
    [
      ["fr", t("french")],
      ["en", t("english")],
    ],
    route.lang,
  )}<label for="search">${esc(t("search"))}<input type="search" id="search" value="${esc(route.q)}" autocomplete="off"></label>${select(
    "directory-sort",
    t("sort"),
    [
      ["alpha", t("alpha")],
      ["difficulty", t("difficulty")],
    ],
    route.sort,
  )}${select("directory-unit", t("unit"), unitOptions(route.lang), route.unit)}</form><div id="directory-results">${directoryResults()}</div>${store.last ? link(sessionURL(store.last.config), t("backSession"), "secondary") : ""}</section>`;
}
function directoryResults() {
  const list = words[route.lang]
    .filter(
      (w) =>
        (!route.unit || w.curriculumUnit === route.unit) &&
        searchKey(w.word).includes(searchKey(route.q)),
    )
    .sort((a, b) =>
      route.sort === "alpha"
        ? a.alphabeticalRank - b.alphabeticalRank
        : a.difficulty - b.difficulty || a.unitOrder - b.unitOrder,
    );
  return `<p class="result-count" role="status">${list.length} ${esc(t("count"))}</p><ul class="word-list">${list.map((w) => `<li><a href="${esc(cardURL(w))}" data-nav><span class="directory-word" lang="${w.language}">${esc(w.word)}</span><span class="word-level">${esc(t("difficulty"))} ${w.difficulty}</span><span class="word-pattern">${esc(w.patterns.join(" · "))}</span><span aria-hidden="true">↗</span><span class="sr-only">${esc(t("open"))}</span></a></li>`).join("")}</ul>${!list.length ? `<p>${esc(t("empty"))}</p>` : ""}`;
}
function errorView() {
  return `<section class="error-page"><span class="meaning-star" aria-hidden="true">✧</span><h1>${esc(t("errorTitle"))}</h1><p class="intro">${esc(t("errorNote"))}</p><div class="completion-actions">${link("/", t("homeButton"), "primary")}${store.last ? link(sessionURL(store.last.config), t("continue"), "secondary") : ""}</div></section>`;
}
function render(focus = false, focusId = "") {
  hideTranslation();
  advancedOpen = document.querySelector("#advanced")?.open ?? advancedOpen;
  app.innerHTML = shell(
    route.view === "home"
      ? home()
      : route.view === "words"
        ? directory()
        : route.view === "error"
          ? errorView()
          : reader(),
  );
  if (focusId) document.getElementById(focusId)?.focus();
  else if (focus)
    document.querySelector("#main").focus({ preventScroll: true });
  document
    .querySelector("#copy-dialog")
    ?.addEventListener("close", () =>
      document
        .querySelector(
          '[data-action="copy-adventure"], [data-action="copy-word"]',
        )
        ?.focus(),
    );
}
function load(focus = true) {
  cardState = "front";
  currentRecord = null;
  try {
    route = parseRoute(location.href);
    if (route.view === "play") {
      const deck = buildDeck(route.config);
      currentRecord = store.visit(route.config, deck);
      history.replaceState(null, "", sessionURL(route.config));
    } else if (route.view === "card") {
      directoryReturn = history.state?.directoryReturn ?? "";
      history.replaceState(
        history.state,
        "",
        cardURL(findWord(route.lang, route.id)),
      );
    } else if (route.view === "words")
      history.replaceState(null, "", directoryURL(route));
  } catch {
    route = { view: "error" };
  }
  render(focus);
}
function navigate(url, replace = false) {
  const state =
    route?.view === "words" && url.startsWith("/card")
      ? { directoryReturn: location.pathname + location.search }
      : null;
  history[replace ? "replaceState" : "pushState"](state, "", url);
  load();
  window.scrollTo(0, 0);
}
function copy(url) {
  const absolute = new URL(url, location.origin).href;
  const fallback = () => {
    const dialog = document.querySelector("#copy-dialog");
    dialog.showModal();
    const field = document.querySelector("#copy-link");
    field.value = absolute;
    field.focus();
    field.select();
  };
  if (navigator.clipboard?.writeText)
    navigator.clipboard
      .writeText(absolute)
      .then(() => toast(t("copied")))
      .catch(fallback);
  else fallback();
}
function configFromForm() {
  const p = store.preferences,
    form = document.querySelector("#setup-form");
  const value = (name) => form.elements.namedItem(name)?.value;
  const changed = {
    ...p,
    lang: value("lang"),
    mode: value("mode"),
    goal: Number(value("goal")),
    case: value("case"),
    order: value("order"),
    min: Number(value("min")),
    max: Number(value("max")),
    unit: value("unit"),
    s: 0,
    i: 0,
  };
  if (value("seed") !== undefined)
    changed.seed =
      value("seed") !== "" && /^\d+$/.test(value("seed"))
        ? Number(value("seed"))
        : -1;
  if (changed.lang !== p.lang) changed.unit = "";
  return changed;
}
function switchLanguage(language) {
  if (language === lang()) return;
  store.preferencesUpdate({ lang: language, unit: "" });
  if (route.view === "play" || route.view === "card") {
    const config = {
      ...(route.config ?? defaults),
      lang: language,
      mode: route.config?.mode ?? store.preferences.mode,
      case: route.config?.case ?? store.preferences.case,
      unit: "",
      s: 0,
      i: 0,
    };
    const saved =
      store.get(config) ??
      store.sessions.find(
        (record) =>
          record.config.lang === language && record.config.mode === config.mode,
      ) ??
      store.sessions.find((record) => record.config.lang === language);
    navigate(sessionURL(saved?.config ?? config));
  } else if (route.view === "words") {
    navigate(directoryURL({ ...route, lang: language, unit: "", q: "" }));
  } else if (route.view === "home") {
    render(false);
  } else {
    navigate("/");
  }
  document
    .querySelector(`.language-button[data-language="${language}"]`)
    ?.focus();
}
app.addEventListener("click", (e) => {
  const anchor = e.target.closest("a[data-nav]");
  if (
    anchor &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.shiftKey &&
    !e.altKey &&
    e.button === 0
  ) {
    e.preventDefault();
    navigate(anchor.getAttribute("href"));
    return;
  }
  const button = e.target.closest("[data-action]");
  if (!button || button.disabled) return;
  const name = button.dataset.action;
  if (name === "previous-story" || name === "next-story") {
    storyIndex =
      (storyIndex + (name === "next-story" ? 1 : -1) + stories.length) %
      stories.length;
    document.querySelector("#story-content").innerHTML = storyContent();
    document.querySelector(".story-position").textContent = storyPosition();
    return;
  }
  if (name === "language") {
    switchLanguage(button.dataset.language);
    return;
  }
  if (name === "theme") {
    store.preferencesUpdate({
      theme: store.preferences.theme === "night" ? "day" : "night",
    });
    render(false);
    document.querySelector('[data-action="theme"]').focus();
    return;
  }
  if (name === "seed") {
    store.preferencesUpdate({
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
    });
    render(false, "seed");
    return;
  }
  if (name === "hint") {
    cardState = cardState === "hint" ? "front" : "hint";
    render(false);
    document.querySelector('[data-action="hint"]').focus();
    return;
  }
  if (name === "flip") {
    cardState = cardState === "back" ? "front" : "back";
    render(false);
    document.querySelector('[data-action="flip"]').focus();
    return;
  }
  const c = route.config;
  const word = c ? buildDeck(c)[c.i] : findWord(route.lang, route.id);
  if (name === "translate") {
    toggleTranslation(word, c?.case ?? store.preferences.case);
    return;
  }
  if (name === "copy-word") {
    copy(cardURL(word));
    return;
  }
  if (name === "copy-adventure") {
    copy(sessionURL(c));
    return;
  }
  if (name === "pause") {
    navigate("/");
    toast(t("paused"));
    return;
  }
  if (name === "previous") {
    navigate(sessionURL({ ...c, i: c.i - 1 }));
    return;
  }
  if (name === "next") {
    if (c.i === roundEnd(c, buildDeck(c).length) - 1) {
      store.complete(c);
      currentRecord = store.get(c);
      render(true);
    } else navigate(sessionURL({ ...c, i: c.i + 1 }));
  }
  if (name === "continue-deck") {
    const next = nextRound(c, buildDeck(c).length);
    if (next.s === 0) store.restart(c);
    navigate(sessionURL(next));
  }
});
app.addEventListener("change", (e) => {
  if (e.target.closest("#setup-form") && e.target.id !== "seed") {
    const c = configFromForm();
    store.preferencesUpdate(c);
    render(false, e.target.id);
  }
  if (e.target.id === "reader-mode" || e.target.id === "reader-case") {
    const field = e.target.id === "reader-mode" ? "mode" : "case";
    store.preferencesUpdate({ [field]: e.target.value });
    if (route.view === "play") {
      const updated = { ...route.config, [field]: e.target.value };
      if (field === "mode") store.transferRound(route.config, updated);
      navigate(sessionURL(updated), true);
    } else render(false);
  }
  if (e.target.closest("#directory-form") && e.target.tagName === "SELECT") {
    const l = document.querySelector("#directory-lang").value;
    const next = {
      view: "words",
      lang: l,
      q: document.querySelector("#search").value,
      sort: document.querySelector("#directory-sort").value,
      unit:
        l !== route.lang ? "" : document.querySelector("#directory-unit").value,
    };
    navigate(directoryURL(next), true);
  }
});
app.addEventListener("input", (e) => {
  if (e.target.id === "seed") {
    const c = configFromForm();
    store.preferencesUpdate(c);
    const invalid =
      c.min > c.max ||
      !Number.isInteger(c.seed) ||
      c.seed < 0 ||
      c.seed > 4294967295;
    const count = invalid ? 0 : buildDeck(c).length;
    const status = document.querySelector("#deck-count");
    status.textContent = invalid
      ? t("invalid")
      : count
        ? `${count} ${t("available")}`
        : t("empty");
    status.className = invalid || !count ? "error-text" : "";
    document.querySelector(".start-row button").disabled = invalid || !count;
  }
  if (e.target.id === "search") {
    route.q = e.target.value;
    history.replaceState(null, "", directoryURL(route));
    document.querySelector("#directory-results").innerHTML = directoryResults();
  }
});
app.addEventListener("submit", (e) => {
  if (e.target.id === "setup-form") {
    e.preventDefault();
    const c = configFromForm();
    try {
      parseRoute(sessionURL(c));
      store.preferencesUpdate(c);
      store.restart(c);
      navigate(sessionURL(c));
    } catch {
      toast(t("invalid"));
    }
  }
  if (e.target.id === "restore-form") {
    e.preventDefault();
    try {
      navigate(
        sessionURL(
          parseAdventureLink(document.querySelector("#adventure-link").value),
        ),
      );
    } catch {
      document.querySelector("#restore-error").textContent = t("errorNote");
    }
  }
  if (e.target.id === "directory-form") e.preventDefault();
});
window.addEventListener("popstate", () => load());
load(false);
// Registration only in production: no development modules enter the offline cache.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .then(async (registration) => {
      await navigator.serviceWorker.ready;
      const controlled = () => {
        offline = "offlineReady";
        const status = document.querySelector("#offline-status");
        if (status) status.textContent = t(offline);
      };
      if (navigator.serviceWorker.controller) controlled();
      else
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          controlled,
          { once: true },
        );
    })
    .catch(() => {
      offline = "offlineError";
      const el = document.querySelector("#offline-status");
      if (el) el.textContent = t(offline);
    });
} else {
  offline = "offlineError";
  const el = document.querySelector("#offline-status");
  if (el) el.textContent = t(offline);
}
