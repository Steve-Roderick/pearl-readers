import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const base =
  "/play?deck=v1&lang=fr&mode=simple&order=learn&case=lower&min=1&max=5&goal=5&s=0&i=0";
const word = (page) => page.locator("#reading-word");
const button = (page, name) => page.locator(`[data-action="${name}"]`);
async function stored(page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("pearl-readers:v1")),
  );
}
async function tools(page) {
  await page.locator(".reader-secondary summary").click();
}

test("defaults to English and dark mode, supports French reading and resumes after refresh", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await expect(page.locator(".brand small")).toHaveText(
    "Kid + parent reading adventure game",
  );
  await page.selectOption("#lang", "fr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await page.getByRole("button", { name: "Nouvelle aventure" }).click();
  await expect(word(page)).toHaveText("ami");
  await expect(button(page, "previous")).toBeDisabled();
  await expect(page.locator(".decoding")).toBeVisible();
  await button(page, "next").click();
  await expect(word(page)).toHaveText("mamie");
  await expect(page.locator(".silent-note")).toBeVisible();
  await expect(page.locator(".silent")).toHaveText("e");
  await page.reload();
  await expect(word(page)).toHaveText("mamie");
  await page.getByRole("link", { name: "Accueil", exact: true }).click();
  await page
    .getByRole("link", { name: "Continuer notre aventure", exact: true })
    .click();
  await expect(word(page)).toHaveText("mamie");
});
test("normal mode has an optional hint and an explicit meaning reveal", async ({
  page,
}) => {
  await page.goto(base.replace("mode=simple", "mode=normal"));
  await expect(page.locator(".decoding")).toHaveCount(0);
  await button(page, "hint").click();
  await expect(page.locator(".segments")).toBeVisible();
  await button(page, "flip").click();
  await expect(page.locator(".example")).toHaveText("Mon ami joue avec moi.");
  await button(page, "next").click();
  await expect(page.locator(".flashcard")).toHaveAttribute(
    "data-state",
    "front",
  );
  await expect(page.locator(".decoding")).toHaveCount(0);
});
test("word state follows browser Back and Forward without losing its place", async ({
  page,
}) => {
  await page.goto(base);
  await button(page, "next").click();
  await button(page, "next").click();
  await expect(word(page)).toHaveText("papi");
  await page.goBack();
  await expect(word(page)).toHaveText("mamie");
  await page.goForward();
  await expect(word(page)).toHaveText("papi");
  await button(page, "previous").click();
  await expect(word(page)).toHaveText("mamie");
  await page.reload();
  await expect(word(page)).toHaveText("mamie");
});
test("copies an exact shuffled adventure and restores it in a fresh device context", async ({
  page,
  browser,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text) => {
          window.copiedLink = text;
        },
      },
    });
  });
  await page.goto(
    "/play?lang=en&mode=normal&order=shuffle&seed=0&goal=15&case=upper&min=2&max=4&s=10&i=12",
  );
  const current = await word(page).textContent();
  await tools(page);
  await button(page, "copy-adventure").click();
  await expect(page.locator("#notice")).toHaveText("Link copied.");
  const copied = await page.evaluate(() => window.copiedLink);
  expect(copied).toContain("seed=0");
  expect(copied).toContain("s=10");
  expect(copied).toContain("i=12");
  const context = await browser.newContext();
  const fresh = await context.newPage();
  await fresh.goto(copied);
  await expect(word(fresh)).toHaveText(current);
  await expect(fresh.locator(".position")).toHaveText("Pearl 3 of 15");
  expect(
    (await stored(fresh)).sessions[
      Object.keys((await stored(fresh)).sessions)[0]
    ].visited,
  ).toHaveLength(1);
  await context.close();
});
test("clipboard denial offers a selectable word permalink", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw Error("denied");
        },
      },
    });
  });
  await page.goto(base);
  await tools(page);
  await button(page, "copy-word").click();
  await expect(page.locator("#copy-dialog")).toBeVisible();
  await expect(page.locator("#copy-link")).toHaveValue(
    /\/card\?deck=v1&lang=fr&id=fr-ami$/,
  );
  const selection = await page
    .locator("#copy-link")
    .evaluate((el) => el.value.slice(el.selectionStart, el.selectionEnd));
  expect(selection).toContain("fr-ami");
  await page.keyboard.press("Escape");
  await expect(page.locator("#copy-dialog")).not.toBeVisible();
});
test("pasted foreign-host links restore locally; invalid links leave saved sessions intact", async ({
  page,
}) => {
  await page.goto(base);
  await button(page, "next").click();
  await page.goto("/");
  await page.locator("#adventure-link").fill("123");
  await page.locator("#restore-form button").click();
  await expect(page.locator("#restore-error")).not.toBeEmpty();
  expect(Object.keys((await stored(page)).sessions)).toHaveLength(1);
  await page
    .locator("#adventure-link")
    .fill("https://somewhere.example/play?lang=en&order=shuffle&seed=0&i=3");
  await page.locator("#restore-form button").click();
  await expect(page).toHaveURL(/127\.0\.0\.1:4173\/play/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
test("French and English sessions survive independently", async ({ page }) => {
  await page.goto(base);
  await button(page, "next").click();
  await button(page, "next").click();
  await page.goto("/");
  await page.selectOption("#lang", "en");
  await page.getByRole("button", { name: "Start new adventure" }).click();
  await button(page, "next").click();
  await expect(word(page)).toHaveText("mat");
  await page.goto("/");
  const state = await stored(page);
  expect(Object.keys(state.sessions)).toHaveLength(2);
  const french = Object.values(state.sessions).find(
    (s) => s.config.lang === "fr",
  );
  expect(french.config.i).toBe(2);
  await page.goto(base.replace("i=0", "i=2"));
  await expect(word(page)).toHaveText("papi");
});
test("directory search handles accents, retains filters and isolates standalone cards", async ({
  page,
}) => {
  await page.goto(base);
  await button(page, "next").click();
  const before = await stored(page);
  await page.getByRole("link", { name: "Les mots", exact: true }).click();
  await page.locator("#search").fill("etoile");
  await expect(page.locator(".word-table tbody tr")).toHaveCount(1);
  await page.locator(".word-table a").click();
  await expect(word(page)).toHaveText("étoile");
  await page.reload();
  await expect(word(page)).toHaveText("étoile");
  expect((await stored(page)).sessions).toEqual(before.sessions);
  await page
    .getByRole("link", { name: "Retour aux mots", exact: true })
    .click();
  await expect(page.locator("#search")).toHaveValue("etoile");
});
test("directory language, difficulty sort and unit filters expose all 200 entries", async ({
  page,
}) => {
  await page.goto("/words?lang=fr");
  await expect(page.locator(".word-table tbody tr")).toHaveCount(100);
  await page.selectOption("#directory-sort", "difficulty");
  await page.selectOption("#directory-unit", "fr-05");
  await expect(page.locator(".word-table tbody tr")).toHaveCount(20);
  await page.selectOption("#directory-lang", "en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".word-table tbody tr")).toHaveCount(100);
  await expect(page.locator(".word-table th")).toHaveText([
    "English",
    "French",
    "Difficulty",
  ]);
  await page.locator("#search").fill("chat");
  await expect(page.locator(".word-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".word-table tbody td")).toHaveText([
    "cat",
    "chat",
    "1",
  ]);
  await expect(page.locator(".word-table a")).toHaveAttribute(
    "href",
    "/card?deck=v1&lang=en&id=en-cat",
  );
  await page.goto("/words?lang=fr&q=chat");
  await expect(page.locator(".word-table th")).toHaveText([
    "Anglais",
    "Français",
    "Niveau",
  ]);
  await expect(page.locator(".word-table tbody td")).toHaveText([
    "cat",
    "chat",
    "3",
  ]);
  await expect(page.locator(".word-table a")).toHaveAttribute(
    "href",
    "/card?deck=v1&lang=fr&id=fr-chat",
  );
});
test("case, reading mode and theme changes preserve the round and visit history", async ({
  page,
}) => {
  // Explicit i must stay inside the round: use the eighth word in a later round.
  await page.goto("/play?lang=fr&unit=fr-05&goal=5&s=5&i=7");
  await expect(word(page)).toHaveText("étoile");
  await tools(page);
  await page.selectOption("#reader-case", "upper");
  await expect(word(page)).toHaveText("ÉTOILE");
  await tools(page);
  await page.selectOption("#reader-mode", "normal");
  await expect(word(page)).toHaveText("ÉTOILE");
  await button(page, "theme").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
  await expect(page.locator(".position")).toHaveText("Perle 3 sur 5");
  await expect(page).toHaveURL(/s=5&i=7/);
  const records = Object.values((await stored(page)).sessions);
  expect(records.find((s) => s.config.mode === "normal").visited).toEqual([
    "fr-etoile",
  ]);
  await page.reload();
  await expect(word(page)).toHaveText("ÉTOILE");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
});
test("completion counts unique visits, resumes the next round and survives reload", async ({
  page,
}) => {
  await page.goto(base);
  await button(page, "next").click();
  await button(page, "previous").click();
  for (let i = 0; i < 4; i++) await button(page, "next").click();
  await button(page, "next").click();
  await expect(page.locator(".visited-count strong")).toHaveText("5");
  await page.reload();
  await expect(page.locator(".completion")).toBeVisible();
  await button(page, "continue-deck").click();
  await expect(word(page)).toHaveText("rat");
  await expect(page.locator(".position")).toHaveText("Perle 1 sur 5");
  expect(new URL(page.url()).searchParams.get("s")).toBe("5");
});
test("short final round ends at deck boundary and offers restart", async ({
  page,
}) => {
  await page.goto("/play?lang=en&goal=10&s=98&i=98");
  await expect(page.locator(".position")).toHaveText("Pearl 1 of 2");
  await button(page, "next").click();
  await button(page, "next").click();
  await expect(page.locator(".completion h1")).toHaveText(
    "Every little discovery is a bubble for your ocean.",
  );
  await expect(button(page, "continue-deck")).toHaveText("Read another set");
  await button(page, "continue-deck").click();
  await expect(word(page)).toHaveText("cat");
  await expect(page.locator(".position")).toHaveText("Pearl 1 of 10");
});
test("early finish preserves position and does not mark a round complete", async ({
  page,
}) => {
  await page.goto(base);
  await button(page, "next").click();
  await button(page, "pause").click();
  await expect(page.locator("#notice")).toContainText("pause");
  expect(Object.values((await stored(page)).sessions)[0].completed).toBe(false);
  await page
    .getByRole("link", { name: "Continue our adventure", exact: true })
    .click();
  await expect(word(page)).toHaveText("mamie");
});
test("empty filter intersection disables Start and seed zero remains valid", async ({
  page,
}) => {
  await page.goto("/");
  await page.selectOption("#lang", "fr");
  await page.locator("#advanced summary").click();
  await page.selectOption("#unit", "fr-02");
  await page.selectOption("#max", "1");
  await expect(page.locator("#setup-form .start-row button")).toBeDisabled();
  await expect(page.locator("#deck-count")).toContainText("Aucun mot");
  await page.selectOption("#max", "5");
  await page.selectOption("#order", "shuffle");
  await page.locator("#seed").fill("0");
  await page.getByRole("button", { name: "Nouvelle aventure" }).click();
  await expect(page).toHaveURL(/seed=0/);
  await expect(word(page)).toBeVisible();
});
test("malformed links recover safely without overwriting a saved adventure", async ({
  page,
}) => {
  await page.goto(base);
  const before = (await stored(page)).sessions;
  for (const query of [
    "lang=xx",
    "seed=-1",
    "i=10",
    "deck=v8",
    "min=5&max=1",
  ]) {
    await page.goto("/play?" + query);
    await expect(page.locator(".error-page")).toBeVisible();
    expect((await stored(page)).sessions).toEqual(before);
  }
  await page.goto("/card?lang=fr&id=%3Cscript%3E");
  await expect(page.locator(".error-page")).toBeVisible();
});
test("corrupt and denied storage never stop reading", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("pearl-readers:v1", "{bad"));
  await page.reload();
  await expect(page.locator(".storage-warning")).toBeVisible();
  await page.getByRole("button", { name: "Start new adventure" }).click();
  await expect(word(page)).toHaveText("cat");
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw Error("denied");
      },
    });
  });
  const denied = await context.newPage();
  await denied.goto("http://127.0.0.1:4173" + base);
  await expect(denied.locator(".storage-warning")).toBeVisible();
  await button(denied, "next").click();
  await expect(word(denied)).toHaveText("mamie");
  await context.close();
});
test("offline deep-link reload works after precaching, without external requests", async ({
  page,
  context,
}) => {
  const external = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:4173")) external.push(r.url());
  });
  await page.goto(base);
  await expect(page.locator("#offline-status")).toHaveText(
    "Lecture hors ligne prête",
  );
  await button(page, "next").click();
  await context.setOffline(true);
  await page.reload();
  await expect(word(page)).toHaveText("mamie");
  await button(page, "next").click();
  await expect(word(page)).toHaveText("papi");
  await page.getByRole("link", { name: "Les mots", exact: true }).click();
  await page.locator("#search").fill("etoile");
  await page.locator(".word-table a").click();
  await expect(word(page)).toHaveText("étoile");
  expect(external).toEqual([]);
});
test("keyboard, reduced motion and phone layouts keep reading controls usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base);
  await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");
  const nav = await page.locator(".reading-navigation").boundingBox();
  expect(nav.y + nav.height).toBeLessThanOrEqual(844);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await button(page, "next").focus();
  await page.keyboard.press("Enter");
  await expect(word(page)).toHaveText("mamie");
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(word(page)).toBeVisible();
});
test("no serious automated accessibility violations on Home, reader, back, directory or completion in both themes", async ({
  page,
}) => {
  for (const theme of ["night", "day"]) {
    await page.goto("/");
    if (theme === "day") await button(page, "theme").click();
    for (const url of ["/", base, "/words?lang=fr"]) {
      await page.goto(url);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations, `${theme} ${url}`).toEqual([]);
    }
    await page.goto(base);
    await button(page, "flip").click();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
});

test("captures the reading experience at desktop and phone sizes", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await page.screenshot({
    path: testInfo.outputPath("home-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.screenshot({
    path: testInfo.outputPath("home-phone.png"),
    fullPage: true,
  });
  await page.goto(base.replace("i=0", "i=1"));
  await page.screenshot({
    path: testInfo.outputPath("reader-phone.png"),
    fullPage: true,
  });
  await button(page, "theme").click();
  await page.screenshot({
    path: testInfo.outputPath("reader-day.png"),
    fullPage: true,
  });
  await page.goto("/words?lang=en&q=zip");
  await page.screenshot({
    path: testInfo.outputPath("word-table-phone.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("the saved adventure offered on Home follows the selected language", async ({
  page,
}) => {
  await page.goto(base.replace("i=0", "i=2"));
  await page.goto(base.replace("lang=fr", "lang=en").replace("i=0", "i=3"));
  await page.goto("/");
  await page.selectOption("#lang", "en");
  await page
    .getByRole("link", { name: "Continue our adventure", exact: true })
    .click();
  await expect(word(page)).toHaveText("map");
  await page.goto("/");
  await page.selectOption("#lang", "fr");
  await page
    .getByRole("link", { name: "Continuer notre aventure", exact: true })
    .click();
  await expect(word(page)).toHaveText("papi");
});

test("completion and error recovery pass automated accessibility checks", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(base);
  for (let i = 0; i < 5; i++) await button(page, "next").click();
  await expect(page.locator(".completion h1")).toHaveText(
    "Chaque petite découverte est une bulle pour ton océan.",
  );
  await expect(page.locator(".bubble-celebration")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(page.locator(".celebration-bubble").first()).toHaveCSS(
    "animation-name",
    "ocean-bubble-rise",
  );
  const motion = await page
    .locator(".celebration-bubble")
    .evaluateAll((bubbles) =>
      bubbles.map((bubble) => {
        const style = getComputedStyle(bubble);
        return {
          end:
            parseFloat(style.animationDuration) +
            parseFloat(style.animationDelay),
          iterations: style.animationIterationCount,
        };
      }),
    );
  expect(
    motion.every(
      (animation) => animation.end <= 5 && animation.iterations === "1",
    ),
  ).toBe(true);
  // Capture a deterministic middle frame without waiting for the animation.
  await page.locator(".celebration-bubble").evaluateAll((bubbles) =>
    bubbles.forEach((bubble) =>
      bubble.getAnimations().forEach((animation) => {
        animation.pause();
        animation.currentTime = 2300;
      }),
    ),
  );
  await page.screenshot({
    path: testInfo.outputPath("completion-bubbles.png"),
    fullPage: true,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".celebration-bubble").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  expect(
    await page
      .locator(".celebration-bubble")
      .first()
      .evaluate((bubble) => Number(getComputedStyle(bubble).opacity)),
  ).toBeGreaterThan(0);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.goto("/play?i=-1");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("long words, 200% text and narrow viewports do not cause horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(base);
  // Exercise the rendering surface's required capacity beyond the current short-word library.
  await page.locator("#reading-word").evaluate((el) => {
    el.classList.add("long-word");
    el.textContent = "hippopotamus";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  const overflowing = await page.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > innerWidth)
      .map((el) => ({
        tag: el.tagName,
        cls: el.className,
        text: el.textContent.slice(0, 60),
        right: el.getBoundingClientRect().right,
      })),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    JSON.stringify(overflowing),
  ).toBe(true);
  await expect(button(page, "next")).toBeVisible();
  for (const url of ["/", "/words?lang=fr"]) {
    await page.goto(url);
    await page.evaluate(
      () => (document.documentElement.style.fontSize = "200%"),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      url,
    ).toBe(true);
  }
});

test("French translation toggles English and restores the current card without changing progress", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto(base);
  const before = await stored(page);
  const flash = page.locator("#translation-flash");
  await page
    .getByRole("button", { name: "Voir en anglais", exact: true })
    .click();
  await expect(flash).toBeVisible();
  await expect(flash.locator(".translation-word")).toHaveText("friend");
  await expect(flash.locator(".translation-word")).toHaveAttribute(
    "lang",
    "en",
  );
  await expect(page.locator(".card-content")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await page.clock.runFor(10000);
  await expect(flash).toBeVisible();
  const back = page.getByRole("button", {
    name: "Retour au français",
    exact: true,
  });
  await expect(back).toHaveAttribute("aria-expanded", "true");
  await back.click();
  await expect(flash).toBeHidden();
  await expect(button(page, "translate")).toHaveText("Voir en anglais");
  await expect(button(page, "translate")).toBeFocused();
  await expect(word(page)).toBeVisible();
  await expect(word(page)).toHaveText("ami");
  expect((await stored(page)).sessions).toEqual(before.sessions);
});

test("English translation toggles French with accents and selected letter case, including standalone cards", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/play?lang=en&mode=normal&case=upper&s=95&i=98");
  await button(page, "translate").click();
  await expect(page.locator(".translation-word")).toHaveText("GÂTEAU");
  await expect(page.locator(".translation-word")).toHaveAttribute("lang", "fr");
  await page.clock.runFor(10000);
  await expect(page.locator(".translation-word")).toBeVisible();
  await page
    .getByRole("button", { name: "Back to English", exact: true })
    .click();
  await expect(button(page, "translate")).toHaveText("Flash French");
  await expect(word(page)).toBeVisible();
  await expect(word(page)).toHaveText("CAKE");
  await button(page, "translate").click();
  await expect(page.locator(".translation-word")).toHaveText("GÂTEAU");
  await button(page, "translate").click();
  await expect(page.locator(".decoding")).toHaveCount(0);
  await page.goto("/card?lang=fr&id=fr-chat");
  await button(page, "translate").click();
  await expect(page.locator(".translation-word")).toHaveText("cat");
});

test("repeated translation taps toggle the card back and forth; navigation and flipping reset it", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto(base);
  await button(page, "flip").click();
  await button(page, "translate").click();
  await page.clock.runFor(1800);
  await button(page, "translate").click();
  await expect(page.locator("#translation-flash")).toBeHidden();
  await expect(page.locator(".example")).toBeVisible();
  await button(page, "translate").click();
  await expect(page.locator("#translation-flash")).toBeVisible();
  await button(page, "translate").click();
  await expect(page.locator(".example")).toBeVisible();
  await expect(page.locator(".flashcard")).toHaveAttribute(
    "data-state",
    "back",
  );
  await button(page, "translate").click();
  await button(page, "next").click();
  await expect(page.locator("#translation-flash")).toBeHidden();
  await expect(word(page)).toHaveText("mamie");
  await page.clock.runFor(3000);
  await expect(word(page)).toHaveText("mamie");
  await button(page, "translate").click();
  await button(page, "flip").click();
  await expect(page.locator("#translation-flash")).toBeHidden();
  await expect(page.locator(".example")).toBeVisible();
});

test("translation is available offline and remains accessible on a phone", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base.replace("mode=simple", "mode=normal"));
  await expect(page.locator("#offline-status")).toHaveText(
    "Lecture hors ligne prête",
  );
  await context.setOffline(true);
  await button(page, "translate").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".translation-word")).toHaveText("friend");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  const nav = await page.locator(".reading-navigation").boundingBox();
  expect(nav.y + nav.height).toBeLessThanOrEqual(844);
});

test("top language buttons are visible, indicate the active language and remember Home selection", async ({
  page,
}) => {
  await page.goto("/");
  const english = page.getByRole("button", { name: "English", exact: true });
  const french = page.getByRole("button", { name: "Français", exact: true });
  await expect(english).toBeVisible();
  await expect(english).toHaveAttribute("aria-pressed", "true");
  await french.click();
  await expect(french).toHaveAttribute("aria-pressed", "true");
  await english.click();
  await expect(english).toHaveAttribute("aria-pressed", "true");
  await expect(french).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#lang")).toHaveValue("en");
  await page.reload();
  await expect(english).toHaveAttribute("aria-pressed", "true");
  await french.click();
  await expect(page.locator("#lang")).toHaveValue("fr");
  for (const width of [320, 600, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(english).toBeVisible();
    await expect(french).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("top language switching resumes independent reading positions and works in the directory", async ({
  page,
}) => {
  await page.goto(base.replace("i=0", "i=2"));
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(word(page)).toHaveText("cat");
  await button(page, "next").click();
  await page.getByRole("button", { name: "Français", exact: true }).click();
  await expect(word(page)).toHaveText("papi");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(word(page)).toHaveText("mat");
  await page.goto("/words?lang=fr&unit=fr-05&q=etoile");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("#directory-lang")).toHaveValue("en");
  await expect(page.locator(".word-table tbody tr")).toHaveCount(100);
  await page.goto("/card?lang=fr&id=fr-chat");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(word(page)).toHaveText("mat");
});
