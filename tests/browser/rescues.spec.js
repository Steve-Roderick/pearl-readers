import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import stories from "../../src/data/stories.json" with { type: "json" };
const next = (p) => p.locator('[data-action="next"]');
const url = (goal = 5, lang = "en") => `/play?lang=${lang}&goal=${goal}`;
async function complete(p, n = 5) {
  for (let i = 0; i < n; i++) await next(p).click();
  await expect(p.locator(".rescue-story")).toBeVisible();
}
async function receipts(p) {
  return p.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith("pearl-readers:rescue:"))
      .map((k) => JSON.parse(localStorage.getItem(k)))
      .sort((a, b) => a.completedAt - b.completedAt),
  );
}

test("home explains the reward, while an empty necklace invites the first rescue", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".hero-promise")).toContainText(
    "Rescue ocean friends",
  );
  await expect(page.locator(".story-selector")).toHaveCount(0);
  await page.locator("header .necklace-link").click();
  await expect(page.locator("#necklace-title")).toHaveText("My pearl necklace");
  await expect(page.locator(".necklace-bead img")).toHaveCount(0);
  await expect(page.locator(".collection-totals dd")).toHaveText([
    "0",
    "0",
    "0 / 20",
  ]);
  await page.getByRole("button", { name: "Français", exact: true }).click();
  await expect(page.locator("#necklace-title")).toHaveText(
    "Mon collier de perles",
  );
});
for (const goal of [5, 10, 15, 20])
  test(`${goal} words yield ${goal} bubbles, a finished story and exactly one animal`, async ({
    page,
  }) => {
    await page.goto(url(goal));
    await complete(page, goal);
    await expect(page.locator(".celebration-bubble")).toHaveCount(goal);
    const r = await receipts(page);
    expect(r).toHaveLength(1);
    expect(r[0].wordCount).toBe(goal);
    const story = stories.find((s) => s.id === r[0].storyId);
    await expect(page.locator("#rescue-title")).toHaveText(story.en.title);
    await expect(page.locator(".rescue-story .story-text p")).toHaveText(
      story.en.paragraphs,
    );
    await expect(page.locator(".rescue-story img")).toHaveAttribute(
      "src",
      `/creatures/${story.creature.id}.svg`,
    );
    await page.reload();
    expect(await receipts(page)).toHaveLength(1);
    await expect(page.locator("#rescue-title")).toHaveText(story.en.title);
    await page.locator(".completion-actions .primary").click();
    await expect(page.locator(".necklace-bead img")).toHaveCount(1);
    await expect(page.locator(".collection-totals dd")).toHaveText([
      String(goal),
      "1",
      "1 / 20",
    ]);
    await expect(page.locator("#rescue-title")).toHaveText(story.en.title);
    await page.getByRole("button", { name: "Français", exact: true }).click();
    await expect(page.locator("#rescue-title")).toHaveText(story.fr.title);
    expect(await receipts(page)).toHaveLength(1);
  });

test("pause, history, case and mode preserve completed cards; final-card links cannot skip the set", async ({
  page,
}) => {
  await page.goto(url());
  await next(page).click();
  await page.locator('[data-action="pause"]').click();
  expect(await receipts(page)).toHaveLength(0);
  await page
    .getByRole("link", { name: "Continue our adventure", exact: true })
    .click();
  await expect(page.locator("#reading-word")).toHaveText("mat");
  await page.locator(".reader-secondary summary").click();
  await page.selectOption("#reader-mode", "normal");
  await page.locator(".reader-secondary summary").click();
  await page.selectOption("#reader-case", "upper");
  await next(page).click();
  await page.goBack();
  await next(page).click();
  // Finish whichever remaining card the history traversal reached.
  for (let i = 0; i < 3; i++) await next(page).click();
  await expect(page.locator(".rescue-story")).toBeVisible();
  expect((await receipts(page))[0].wordCount).toBe(5);
  await page.goto("/play?lang=fr&goal=5&i=4");
  await next(page).click();
  await expect(page.locator("#reading-word")).toHaveText("ami");
  expect(await receipts(page)).toHaveLength(1);
});

test("twenty distinct rescues fill a strand; repeated practice earns a twenty-first pearl", async ({
  page,
}, info) => {
  await page.goto(url());
  for (let i = 0; i < 21; i++) {
    await complete(page);
    if (i < 20) await page.locator('[data-action="continue-deck"]').click();
  }
  const r = await receipts(page);
  expect(r).toHaveLength(21);
  expect(new Set(r.slice(0, 20).map((r) => r.storyId)).size).toBe(20);
  await page.goto("/necklace?lang=en&strand=0");
  await expect(page.locator(".necklace-bead img")).toHaveCount(20);
  await page.setViewportSize({ width: 1200, height: 1000 });
  await page.screenshot({
    path: info.outputPath("necklace-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: info.outputPath("necklace-phone.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Next →", exact: true }).click();
  await expect(page.locator(".necklace-bead img")).toHaveCount(1);
  await expect(page.locator(".collection-totals dd")).toHaveText([
    "105",
    "21",
    "20 / 20",
  ]);
  await page.locator(".necklace-bead").first().click();
  await expect(page.locator(".rescue-story")).toBeVisible();
});

test("completed story and necklace artwork work offline, including a direct reload", async ({
  page,
  context,
}) => {
  await page.goto(url(5, "fr"));
  await expect(page.locator("#offline-status")).toHaveText(
    "Lecture hors ligne prête",
  );
  await context.setOffline(true);
  await complete(page);
  await page.locator(".completion-actions .primary").click();
  await page.reload();
  await expect(page.locator("#necklace-title")).toHaveText(
    "Mon collier de perles",
  );
  expect(
    await page
      .locator(".necklace-bead img")
      .evaluate((img) => img.complete && img.naturalWidth > 0),
  ).toBe(true);
  await page.locator(".necklace-bead").first().click();
  await expect(page.locator(".rescue-story")).toBeVisible();
  await page.reload();
  await expect(page.locator(".rescue-story")).toBeVisible();
});

test("large lifetime totals use a bounded bubble pool, skip and cancel when leaving", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate((storyId) => {
    for (let i = 0; i < 200; i++) {
      const id = `test-attempt-${String(i).padStart(5, "0")}`;
      localStorage.setItem(
        "pearl-readers:rescue:" + id,
        JSON.stringify({
          attemptId: id,
          storyId,
          wordCount: 20,
          language: "en",
          completedAt: i,
        }),
      );
    }
  }, stories[0].id);
  await page.goto("/necklace?lang=en");
  await expect(page.locator(".collection-totals dd").first()).toHaveText(
    "4000",
  );
  await page.waitForTimeout(600);
  expect(await page.locator(".lifetime-bubble").count()).toBeGreaterThan(0);
  expect(await page.locator(".lifetime-bubble").count()).toBeLessThanOrEqual(
    24,
  );
  await page.getByRole("button", { name: "Skip bubbles" }).click();
  await expect(page.locator("#bubble-count")).toHaveText("4000");
  await expect(page.locator(".lifetime-bubble")).toHaveCount(0);
  await page.getByRole("link", { name: "Return home", exact: true }).click();
  await expect(page.locator(".lifetime-bubbles")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/necklace?lang=en");
  await expect(page.locator("#bubble-count")).toHaveText("4000");
  await expect(page.locator(".lifetime-bubble")).toHaveCount(0);
});

test("two tabs completing the same attempt cannot duplicate its award", async ({
  page,
  context,
}) => {
  await page.goto(url());
  for (let i = 0; i < 4; i++) await next(page).click();
  const second = await context.newPage();
  await second.goto(page.url());
  await Promise.all([next(page).click(), next(second).click()]);
  await expect(page.locator(".rescue-story")).toBeVisible();
  await expect(second.locator(".rescue-story")).toBeVisible();
  expect(await receipts(page)).toHaveLength(1);
  await second.getByRole("button", { name: "Switch day / night" }).click();
  await page.reload();
  expect(await receipts(page)).toHaveLength(1);
});

test("necklace and rescue screens are accessible in both themes, languages and narrow layouts", async ({
  page,
}, info) => {
  await page.goto(url());
  await complete(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: info.outputPath("rescue-phone.png"),
    fullPage: true,
  });
  for (const language of ["en", "fr"]) {
    await page.goto(`/necklace?lang=${language}`);
    for (let i = 0; i < 2; i++) {
      const report = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(report.violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page
        .getByRole("button", {
          name:
            language === "en" ? "Switch day / night" : "Changer jour / nuit",
        })
        .click();
    }
    await page.locator(".necklace-bead").first().click();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    for (const width of [320, 768, 1200]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});

test("independent tabs earn different animals, including on hosts without randomUUID", async ({
  page,
  context,
}) => {
  await context.addInitScript(() =>
    Object.defineProperty(crypto, "randomUUID", { value: undefined }),
  );
  await page.goto(url(5, "en"));
  for (let i = 0; i < 4; i++) await next(page).click();
  const second = await context.newPage();
  await second.goto(url(5, "fr"));
  for (let i = 0; i < 4; i++) await next(second).click();
  await Promise.all([next(page).click(), next(second).click()]);
  await expect(page.locator(".rescue-story")).toBeVisible();
  await expect(second.locator(".rescue-story")).toBeVisible();
  const earned = await receipts(page);
  expect(earned).toHaveLength(2);
  expect(new Set(earned.map((r) => r.storyId)).size).toBe(2);
  await expect(page.locator(".pearl-joining img")).toBeVisible();
});

for (const language of ['en', 'fr']) {
  test(`necklace opens the next ${language} set with one click and resumes it while unfinished`, async ({page}) => {
    await page.goto(url(5, language));
    await complete(page);
    const earned = (await receipts(page))[0].attemptId;
    await page.locator('.completion-actions .primary').click();
    await page.locator('[data-action="read-another-set"]').click();
    await expect(page.locator('#reading-word')).toBeVisible();
    expect(new URL(page.url()).searchParams.get('s')).toBe('5');
    expect(new URL(page.url()).searchParams.get('i')).toBe('5');
    expect(new URL(page.url()).searchParams.get('lang')).toBe(language);
    const record = await page.evaluate(() => {
      const data=JSON.parse(localStorage.getItem('pearl-readers:v1'));
      return data.sessions[data.lastActive];
    });
    expect(record.attemptId).not.toBe(earned);
    expect(record.readIds).toEqual([]);
    expect(await receipts(page)).toHaveLength(1);
    await next(page).click();
    await page.locator('header .necklace-link').click();
    await page.locator('[data-action="read-another-set"]').click();
    expect(new URL(page.url()).searchParams.get('i')).toBe('6');
    for(let i=0;i<4;i++) await next(page).click();
    await expect(page.locator('.rescue-story')).toBeVisible();
    expect(await receipts(page)).toHaveLength(2);
  });
}

test('necklace starts a first set directly and wraps after the final set', async ({page}) => {
  await page.goto('/necklace?lang=en');
  await page.locator('[data-action="read-another-set"]').click();
  await expect(page.locator('#reading-word')).toHaveText('cat');
  await page.goto('/play?lang=en&goal=10&s=98&i=98');
  await complete(page,2);
  await page.locator('.completion-actions .primary').click();
  await page.locator('[data-action="read-another-set"]').click();
  await expect(page.locator('#reading-word')).toHaveText('cat');
  expect(new URL(page.url()).searchParams.get('s')).toBe('0');
  expect(await receipts(page)).toHaveLength(1);
});
