import translations from "./data/translations.json";

// Contextual meanings are authored separately from the immutable reading decks.
export function translationFor(word) {
  return {
    language: word.language === "fr" ? "en" : "fr",
    text: translations[word.language][word.id],
  };
}
