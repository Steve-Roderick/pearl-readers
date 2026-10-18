import fs from "node:fs";
import { expect, it } from "vitest";
import stories from "../../src/data/stories.json";

it("provides twenty distinct bilingual stories with complete, normalized passages", () => {
  expect(stories).toHaveLength(20);
  expect(new Set(stories.map((story) => story.id)).size).toBe(20);
  expect(new Set(stories.map((s) => s.creature.id)).size).toBe(20);
  for (const story of stories)
    expect(fs.existsSync(`public/creatures/${story.creature.id}.svg`)).toBe(
      true,
    );
  for (const language of ["en", "fr"]) {
    expect(new Set(stories.map((story) => story[language].title)).size).toBe(
      20,
    );
    for (const story of stories) {
      expect(story.creature[language]).toBeTruthy();
      expect(story[language].paragraphs[2]).not.toMatch(/\?/);
      expect(story[language].paragraphs).toHaveLength(3);
      for (const text of [
        story[language].title,
        ...story[language].paragraphs,
      ]) {
        expect(text.trim()).not.toBe("");
        expect(text).toBe(text.normalize("NFC"));
      }
    }
  }
});
