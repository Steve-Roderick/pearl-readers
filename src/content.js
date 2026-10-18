import en from "./data/v1/en.json";
import fr from "./data/v1/fr.json";
import enUnits from "./data/v1/curriculum-en.json";
import frUnits from "./data/v1/curriculum-fr.json";
export const BUNDLE = "v1";
export const words = { en, fr };
export const curricula = { en: enUnits, fr: frUnits };
export const findWord = (lang, id) =>
  words[lang]?.find((word) => word.id === id);
export function displayCase(text, letterCase, lang) {
  if (letterCase === "upper") return text.toLocaleUpperCase(lang);
  if (letterCase === "title")
    return text.charAt(0).toLocaleUpperCase(lang) + text.slice(1);
  return text;
}
export function displaySegments(word, letterCase) {
  return word.decoding.segments.map((segment, index) => ({
    ...segment,
    text: displayCase(
      segment.text,
      letterCase === "title" && index > 0 ? "lower" : letterCase,
      word.language,
    ),
  }));
}
export const searchKey = (text) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
