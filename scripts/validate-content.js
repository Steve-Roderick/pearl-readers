import fs from "node:fs";
import { pathToFileURL } from "node:url";
export function validateContent(
  libraries,
  units,
  {
    assetExists = (path) => fs.existsSync(`public${path}`),
    expectedCount = 100,
  } = {},
) {
  const errors = [],
    allIds = new Set();
  for (const lang of ["en", "fr"]) {
    const words = libraries[lang],
      curriculum = units[lang];
    if (!Array.isArray(words) || words.length !== expectedCount) {
      errors.push(`${lang}: expected ${expectedCount} words`);
      continue;
    }
    if (!Array.isArray(curriculum) || !curriculum.length) {
      errors.push(`${lang}: missing curriculum`);
      continue;
    }
    const unitIds = new Set(),
      unitSequences = new Set();
    for (const u of curriculum) {
      if (
        !u.id?.startsWith(lang + "-") ||
        unitIds.has(u.id) ||
        !Number.isInteger(u.sequence) ||
        u.sequence < 1 ||
        unitSequences.has(u.sequence) ||
        !u.title ||
        !u.note
      )
        errors.push(`${lang}: invalid curriculum unit`);
      unitIds.add(u.id);
      unitSequences.add(u.sequence);
    }
    const spellings = new Set(),
      ranks = new Set(),
      positions = new Set();
    for (const w of words) {
      const issue = (msg) => errors.push(`${w.id ?? lang}: ${msg}`);
      if (
        typeof w.id !== "string" ||
        !new RegExp(`^${lang}-[a-z0-9-]+$`).test(w.id) ||
        allIds.has(w.id)
      )
        issue("invalid or duplicate ID");
      allIds.add(w.id);
      if (w.language !== lang) issue("invalid language");
      if (
        typeof w.word !== "string" ||
        !w.word ||
        w.word !== w.word.normalize("NFC") ||
        w.word !== w.word.toLocaleLowerCase(lang) ||
        spellings.has(w.word)
      )
        issue("invalid or duplicate spelling");
      spellings.add(w.word);
      if (!unitIds.has(w.curriculumUnit)) issue("unknown unit");
      if (
        !Number.isInteger(w.difficulty) ||
        w.difficulty < 1 ||
        w.difficulty > 5
      )
        issue("invalid difficulty");
      const position = `${w.curriculumUnit}:${w.unitOrder}`;
      if (
        !Number.isInteger(w.unitOrder) ||
        w.unitOrder < 1 ||
        positions.has(position)
      )
        issue("invalid unit order");
      positions.add(position);
      if (
        !Number.isInteger(w.alphabeticalRank) ||
        w.alphabeticalRank < 1 ||
        w.alphabeticalRank > words.length ||
        ranks.has(w.alphabeticalRank)
      )
        issue("invalid alphabetical rank");
      ranks.add(w.alphabeticalRank);
      if (
        !Array.isArray(w.patterns) ||
        !w.patterns.length ||
        w.patterns.some((p) => typeof p !== "string" || !p)
      )
        issue("missing patterns");
      if (
        !["regular", "partially_regular", "irregular"].includes(w.regularity) ||
        typeof w.exceptionNote !== "string"
      )
        issue("missing regularity or notes");
      if (
        typeof w.example !== "string" ||
        !w.example.trim() ||
        w.example !== w.example.normalize("NFC")
      )
        issue("missing or invalid example");
      if (!["draft", "educator-reviewed"].includes(w.review?.status))
        issue("missing review status");
      if (
        w.review?.status === "educator-reviewed" &&
        (!w.review.reviewer || !/^\d{4}-\d{2}-\d{2}$/.test(w.review.date ?? ""))
      )
        issue("review provenance required");
      const d = w.decoding;
      if (
        !["graphemes", "syllables", "onset-rime"].includes(d?.kind) ||
        !Array.isArray(d?.segments) ||
        !d.segments.length
      )
        issue("missing decoding representation");
      else {
        if (
          d.segments.some(
            (s) =>
              typeof s.text !== "string" ||
              !s.text ||
              s.text !== s.text.normalize("NFC") ||
              typeof s.spoken !== "boolean",
          ) ||
          !d.segments.some((s) => s.spoken)
        )
          issue("invalid segments");
        if (d.segments.map((s) => s.text).join("") !== w.word)
          issue("segments must reconstruct word");
        if (d.segments.some((s) => !s.spoken) && !w.exceptionNote)
          issue("silent letters require a parent note");
      }
      for (const kind of ["image", "audio"])
        if (
          w[kind] !== undefined &&
          w[kind] !== null &&
          (typeof w[kind] !== "string" ||
            !/^\/(images|audio)\/[a-zA-Z0-9_./-]+$/.test(w[kind]) ||
            w[kind].includes("..") ||
            !assetExists(w[kind]))
        )
          issue(`missing or unsafe ${kind} asset`);
    }
    for (const id of unitIds)
      if (!words.some((w) => w.curriculumUnit === id))
        errors.push(`${id}: empty curriculum unit`);
  }
  return errors;
}
export function validateTranslations(libraries, translations) {
  const errors = [];
  for (const lang of ["en", "fr"]) {
    const entries = translations?.[lang];
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
      errors.push(`${lang}: missing translations`);
      continue;
    }
    const ids = new Set(libraries[lang].map((word) => word.id));
    for (const id of ids) {
      const text = entries[id];
      if (
        typeof text !== "string" ||
        !text.trim() ||
        text !== text.trim() ||
        text !== text.normalize("NFC")
      ) {
        errors.push(`${id}: missing or invalid translation`);
      }
    }
    for (const id of Object.keys(entries))
      if (!ids.has(id)) errors.push(`${id}: unknown translation word`);
  }
  return errors;
}
export function readContent() {
  const read = (name) =>
    JSON.parse(
      fs.readFileSync(
        new URL(`../src/data/v1/${name}.json`, import.meta.url),
        "utf8",
      ),
    );
  return {
    libraries: { en: read("en"), fr: read("fr") },
    units: { en: read("curriculum-en"), fr: read("curriculum-fr") },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { libraries, units } = readContent();
  const translations = JSON.parse(
    fs.readFileSync(
      new URL("../src/data/translations.json", import.meta.url),
      "utf8",
    ),
  );
  const errors = [
    ...validateContent(libraries, units),
    ...validateTranslations(libraries, translations),
  ];
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else
    console.log(
      "Content valid: 100 English + 100 French entries with translations; all 200 await educator review.",
    );
}
