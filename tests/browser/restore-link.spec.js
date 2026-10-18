import { test, expect } from "@playwright/test";

const origin = "http://192.168.0.81:5173";
const query =
  "deck=v1&lang=en&mode=simple&order=learn&case=lower&min=1&max=5&goal=10";

for (const { start, index, word } of [
  { start: 0, index: 9, word: "bag" },
  { start: 20, index: 29, word: "sit" },
]) {
  test(`restores the supplied LAN adventure link at deck index ${index}`, async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .locator("#adventure-link")
      .fill(`${origin}/play?${query}&s=${start}&i=${index}`);
    await page.locator("#restore-form button").click();
    await expect(page.locator("#reading-word")).toHaveText(word);
    await expect(page.locator(".position")).toHaveText("Pearl 10 of 10");
  });
}

test("mobile-friendly restore input accepts formatted clipboard links without opening another host", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const input = page.locator("#adventure-link");
  await expect(input).toHaveAttribute("inputmode", "url");
  await expect(input).toHaveAttribute("autocapitalize", "none");
  await expect(input).toHaveAttribute("autocorrect", "off");
  await expect(input).toHaveAttribute("spellcheck", "false");
  const link = `${origin}/play?${query}&s=20&i=29`;
  await input.fill(`\u200e<${link.replaceAll("&", "&amp;")}>\u200b`);
  await page.locator("#restore-form button").click();
  await expect(page.locator("#reading-word")).toHaveText("sit");
  await expect(page).toHaveURL(/127\.0\.0\.1:4173\/play/);
});
