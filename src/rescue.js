import stories from "./data/stories.json";
import { messages } from "./i18n.js";
const esc = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const necklaceIcon = `<svg viewBox="0 0 36 30" aria-hidden="true" fill="none"><path d="M5 3c-2 29 28 29 26 0" stroke="currentColor" stroke-width="1.2"/>${[
  [5, 8],
  [6, 14],
  [9, 20],
  [15, 24],
  [22, 24],
  [28, 20],
  [30, 14],
  [31, 8],
]
  .map(
    ([x, y]) =>
      `<circle cx="${x}" cy="${y}" r="2.8" fill="var(--cream)" stroke="currentColor"/>`,
  )
  .join(
    "",
  )}<path d="m18 11 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" fill="currentColor"/></svg>`;
export const necklaceURL = (lang, strand = 0, rescue = "") =>
  `/necklace?${new URLSearchParams({ lang, strand, ...(rescue ? { rescue } : {}) })}`;
export function stamp(story, cls = "") {
  return `<img class="animal-stamp ${cls}" src="/creatures/${story.creature.id}.svg" alt="" width="128" height="128">`;
}
export function earnedPearl(storyId) {
  const story = stories.find((s) => s.id === storyId);
  return `<div class="pearl-joining" aria-hidden="true">${stamp(story)}<span>✧</span>${necklaceIcon}</div>`;
}
export function rescueStory(storyId, language, heading = "h2") {
  const story = stories.find((s) => s.id === storyId);
  if (!story) return "";
  return `<article class="rescue-story" aria-labelledby="rescue-title">${stamp(story)}<p class="eyebrow">${esc(story.creature[language])}</p><${heading} id="rescue-title">${esc(story[language].title)}</${heading}><div class="story-text">${story[language].paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}</div></article>`;
}
export function roundBubbles(count) {
  return `<div class="bubble-celebration rescue-celebration" aria-hidden="true"><div class="celebration-bubbles">${Array.from({ length: count }, (_, i) => `<span class="celebration-bubble" data-bubble-index="${i}"></span>`).join("")}</div><span class="bubble-sparkles">✧ · ✦ · ✧</span></div>`;
}
export function necklacePage(route, receipts) {
  const l = route.lang,
    t = (k) => messages[l][k];
  const total = receipts.reduce((sum, r) => sum + r.wordCount, 0);
  const strands = Math.max(1, Math.ceil(receipts.length / 20));
  const strand = Math.min(route.strand, strands - 1);
  const beads = receipts.slice(strand * 20, strand * 20 + 20);
  const selected = receipts.find((r) => r.attemptId === route.rescue);
  const shown = beads.length + Math.min(3, 20 - beads.length);
  // Two scalloped rows of ten beads keep every animal large enough to recognise.
  const beadsHTML = Array.from({ length: shown }, (_, i) => {
    const r = beads[i];
    if (!r)
      return `<span class="necklace-bead empty-bead" data-bead-index="${i}" aria-hidden="true"></span>`;
    const story = stories.find((s) => s.id === r.storyId);
    return `<a class="necklace-bead" href="${necklaceURL(l, strand, r.attemptId)}#rescued-story" data-nav data-bead-index="${i}" aria-label="${esc(story.creature[l] + ": " + story[l].title)}">${stamp(story)}<span class="bead-number">${strand * 20 + i + 1}</span></a>`;
  }).join("");
  return `<section class="necklace-page" aria-labelledby="necklace-title"><p class="eyebrow">✧ Pearl Readers</p><h1 id="necklace-title">${esc(t("necklace"))}</h1><p class="intro">${esc(t(receipts.length ? "necklaceIntro" : "necklaceEmpty"))}</p><dl class="collection-totals"><div><dt>${esc(t("wordsTogether"))}</dt><dd>${total}</dd></div><div><dt>${esc(t("rescues"))}</dt><dd>${receipts.length}</dd></div><div><dt>${esc(t("oceanFriends"))}</dt><dd>${new Set(receipts.map((r) => r.storyId)).size} / 20</dd></div></dl><div class="bubble-tally"><p><span id="bubble-count">${total === 0 ? 0 : "0"}</span> / ${total} ${esc(t("oceanBubbles"))}</p>${total ? `<button class="text-button" data-action="skip-bubbles">${esc(t("skipBubbles"))}</button>` : ""}</div><div class="necklace-display" aria-label="${esc(t("strand"))} ${strand + 1}"><svg class="necklace-thread" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true"><path d="M60 85 Q500 265 940 85 M60 300 Q500 480 940 300" fill="none" stroke="currentColor" stroke-width="2"/><path d="m485 20 15-10 15 10-15 10Z" fill="currentColor"/></svg>${beadsHTML}</div><div class="strand-navigation">${strand > 0 ? `<a class="secondary" data-nav href="${necklaceURL(l, strand - 1)}">← ${esc(t("previous"))}</a>` : ""}<p>${esc(t("strand"))} ${strand + 1} / ${strands}</p>${strand < strands - 1 ? `<a class="secondary" data-nav href="${necklaceURL(l, strand + 1)}">${esc(t("next"))} →</a>` : ""}</div><p class="quiet-note">${esc(t("necklaceHint"))}</p>${selected ? `<div id="rescued-story">${rescueStory(selected.storyId, l)}</div>` : ""}<div class="completion-actions"><a class="primary" href="/#adventure" data-nav>${esc(t("readAnother"))}</a><a class="secondary" href="/" data-nav>${esc(t("homeButton"))}</a></div><p class="collection-privacy">${esc(t("collectionPrivacy"))}</p></section><div class="lifetime-bubbles" aria-hidden="true" data-total="${total}"></div>`;
}
let stop = () => {};
export function stopBubbles() {
  stop();
  stop = () => {};
}
export function startBubbles() {
  stopBubbles();
  const field = document.querySelector(".lifetime-bubbles"),
    counter = document.querySelector("#bubble-count");
  if (!field) return;
  const total = Number(field.dataset.total),
    reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const skip = document.querySelector('[data-action="skip-bubbles"]');
  let count = 0,
    timer,
    active = true;
  const finish = () => {
    active = false;
    clearInterval(timer);
    field.replaceChildren();
    counter.textContent = String(total);
    if (skip) skip.hidden = true;
  };
  stop = finish;
  if (reduced.matches || !total) {
    finish();
    return;
  }
  const tick = () => {
    if (!active || document.hidden) return;
    // At most 24 live particles; each represents exactly one earned word.
    for (
      let i = 0;
      i < 4 && count < total && field.childElementCount < 24;
      i++
    ) {
      const bubble = document.createElement("span");
      bubble.className = "lifetime-bubble";
      bubble.style.left = `${4 + ((count * 37) % 92)}%`;
      bubble.style.width =
        bubble.style.height = `${18 + ((count * 13) % 40)}px`;
      bubble.addEventListener(
        "animationend",
        () => {
          bubble.remove();
          if (count === total && !field.childElementCount) finish();
        },
        { once: true },
      );
      field.append(bubble);
      count++;
    }
    counter.textContent = String(count);
  };
  timer = setInterval(tick, 180);
  tick();
  skip?.addEventListener("click", finish, { once: true });
  const onMotion = () => {
    if (reduced.matches) finish();
  };
  reduced.addEventListener("change", onMotion);
  stop = () => {
    finish();
    reduced.removeEventListener("change", onMotion);
  };
}
