# Content review before educational release

The initial bundle has 100 English and 100 French entries across five independently
authored units per language. The content is a draft engineering library, not a
validated curriculum. No reviewer, source provenance, or classroom alignment has
been invented. Difficulty 1–5 describes this draft sequence only.

Review `src/data/v1/en.json`, `fr.json`, and the two curriculum files with an early
literacy educator familiar with each language. Check every word's spelling,
meaning, regional pronunciation, grapheme grouping, silent letters, natural
example, exception note, regularity, and place in the sequence. Check cumulative
pattern prerequisites, including newly introduced blends and French letter-final
orthography. English `x` represents two phonemes; split digraphs (`cake`, `kite`)
and regional vowels need their notes. The French `chut` entry explicitly names
its selected silent-t variant. These are spelling groups, not recorded phonemes.

Each word has one representation:

```json
{
  "kind": "graphemes",
  "segments": [
    { "text": "ch", "spoken": true },
    { "text": "a", "spoken": true },
    { "text": "t", "spoken": false }
  ]
}
```

Segments reconstruct the canonical NFC spelling. A segment cannot mix unmarked
spoken and silent letters. The UI labels silent letters and explains their
marking independently of colour. Content is never split algorithmically at runtime.
Syllables and onset/rime representations are supported by the rendering/schema
but are not interchangeable with phonemes.

Set `review.status` to `educator-reviewed` only after a real review. Record the
actual `review.reviewer` and ISO `review.date` (required by validation), and real
source/notes where relevant. Never infer review from an automated test result.
The validator checks structure, not the truth of review assertions. Update the
parent-facing preview note only when review coverage actually warrants it.

If content must change after the published v1 bundle is in use, create a new
version and preserve v1 replay, rather than changing the meaning of existing
shared URLs. Before initial publication, corrections to this unreleased draft
remain appropriate.
