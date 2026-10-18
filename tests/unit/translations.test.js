import { describe, it, expect } from "vitest";
import translations from "../../src/data/translations.json";
import { words } from "../../src/content.js";
import { translationFor } from "../../src/translations.js";
import { validateTranslations } from "../../scripts/validate-content.js";

describe("authored contextual translations", () => {
  it("covers all 200 words in the opposite language without changing the decks", () => {
    expect(validateTranslations(words, translations)).toEqual([]);
    for (const language of ["en", "fr"]) {
      for (const word of words[language]) {
        const result = translationFor(word);
        expect(result.language).toBe(language === "en" ? "fr" : "en");
        expect(result.text.trim()).not.toBe("");
      }
    }
  });
  it("uses meanings consistent with the examples for ambiguous words", () => {
    for (const [language, word, expected] of [
      ["en", "bat", "chauve-souris"],
      ["en", "can", "pouvoir"],
      ["fr", "moule", "mussel"],
      ["fr", "pile", "battery"],
      ["fr", "tour", "tower"],
    ]) {
      expect(
        translationFor(words[language].find((w) => w.word === word)).text,
      ).toBe(expected);
    }
  });
  it("rejects missing translations, empty text, non-NFC accents and stray IDs", () => {
    const invalid = structuredClone(translations);
    delete invalid.fr["fr-chat"];
    invalid.en["en-cat"] = " ";
    invalid.en["en-cake"] = "ga\u0302teau";
    invalid.fr["fr-unknown"] = "unknown";
    const errors = validateTranslations(words, invalid).join("\n");
    for (const id of ["fr-chat", "en-cat", "en-cake", "fr-unknown"])
      expect(errors).toContain(id);
  });
});
