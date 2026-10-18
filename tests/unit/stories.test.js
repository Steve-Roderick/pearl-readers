import { expect, it } from "vitest";
import stories from "../../src/data/stories.json";

it("provides ten distinct bilingual stories with complete, normalized passages", () => {
  expect(stories).toHaveLength(10);
  expect(new Set(stories.map((story) => story.id)).size).toBe(10);
  for (const language of ["en", "fr"]) {
    expect(new Set(stories.map((story) => story[language].title)).size).toBe(
      10,
    );
    for (const story of stories) {
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
