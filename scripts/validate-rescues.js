import fs from "node:fs";
const stories = JSON.parse(fs.readFileSync("src/data/stories.json", "utf8"));
const errors = [];
if (stories.length !== 20) errors.push("Expected twenty rescue stories");
for (const field of [(s) => s.id, (s) => s.creature?.id]) {
  if (new Set(stories.map(field)).size !== 20)
    errors.push("Duplicate story or creature ID");
}
for (const s of stories) {
  if (!/^[a-z-]+$/.test(s.id) || !/^[a-z-]+$/.test(s.creature?.id))
    errors.push("Invalid rescue ID");
  if (!fs.existsSync(`public/creatures/${s.creature?.id}.svg`))
    errors.push(`${s.id}: missing illustration`);
  for (const lang of ["en", "fr"]) {
    const text = s[lang];
    if (!text || text.paragraphs?.length !== 3 || !s.creature?.[lang]) {
      errors.push(`${s.id}: missing ${lang} story`);
      continue;
    }
    for (const value of [text.title, ...text.paragraphs]) {
      if (
        typeof value !== "string" ||
        !value.trim() ||
        value !== value.normalize("NFC")
      )
        errors.push(`${s.id}: invalid ${lang} text`);
    }
    if (text.paragraphs[2].includes("?"))
      errors.push(`${s.id}: ending must resolve the rescue`);
    if (lang === "en") {
      const count = text.paragraphs.join(" ").split(/\s+/).length;
      if (count < 65 || count > 95)
        errors.push(`${s.id}: story length ${count}`);
    }
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    "Rescues valid: twenty bilingual stories with local animal illustrations.",
  );
