// Builds the prompt sent to Groq. Kept separate from ai-client.js so the
// prompt shape can be iterated on without touching the fetch/parsing logic.

/**
 * @param {{particles: boolean, conjugations: boolean, auxVerbs: boolean, slang: boolean}} categories
 * @returns {string}
 */
function buildCategoryInstruction(categories) {
  const included = ['voice', 'other'];
  if (categories.particles) included.push('particle');
  if (categories.conjugations) included.push('conjugation');
  if (categories.auxVerbs) included.push('auxverb');
  if (categories.slang) included.push('slang');

  const excluded = ['particle', 'conjugation', 'auxverb', 'slang'].filter((c) => !included.includes(c));

  let instruction = `Only include grammarPoints whose "category" is one of: ${included.join(', ')}.`;
  if (excluded.length > 0) {
    instruction += ` Do NOT include any grammar point whose category would be: ${excluded.join(', ')} — the user has turned those categories off.`;
  }
  return instruction;
}

const RESPONSE_SCHEMA_DESCRIPTION = `
CRITICAL RULES:
- NEVER use furigana or romaji anywhere in your response. All Japanese text is kanji/hiragana/katakana only, with no bracketed readings and no romanized text.
- Analyze grammar using the WHOLE sentence as context, never in isolation. Explain what each particle/form is actually doing in THIS sentence (e.g. whether a particle marks location, source, or means here; whether a passive is literal or idiomatic here; how casual speech shifts the nuance here). Do not give generic dictionary definitions divorced from this sentence.
- Every Japanese fragment used for "fragment" or "example" fields must be written in natural Japanese only (kanji/kana), no readings attached.

Respond with a JSON object with EXACTLY this shape:

{
  "translation": "natural English translation of the sentence",
  "sentenceBreakdown": [
    {"fragment": "a chunk of the original sentence (a few characters to a clause)", "meaning": "short gloss of that chunk in context"}
  ],
  "grammarPoints": [
    {
      "displayName": "the grammar point exactly as it appears in the sentence, e.g. がたい or 言われます",
      "category": "particle|conjugation|auxverb|slang|voice|other",
      "meaning": "1-2 concise lines: what this expresses",
      "formation": "how it is formed / what it attaches to",
      "nuance": "why THIS sentence uses it this way — contextual nuance, not a generic definition",
      "example": "one example sentence using this grammar point (different from the analyzed sentence)",
      "similarGrammar": [
        {"name": "a related/confusable grammar point", "note": "one short line on how it differs from this one"}
      ]
    }
  ]
}

Category guide:
- "particle": は, が, を, に, で, と, も, から, まで, etc.
- "auxverb": auxiliary adjectives/verbs attached to a stem, e.g. がたい, やすい, そうだ, たがる
- "slang": casual contractions/quotation markers/colloquial speech, e.g. って used casually, casual verb endings, dropped particles
- "voice": passive/causative/causative-passive/potential forms
- "conjugation": tense/negation/politeness conjugation not covered by the above (e.g. plain past, te-form linking)
- "other": anything grammatically notable that doesn't fit the above

sentenceBreakdown should cover the ENTIRE sentence as a sequence of small chunks, in order, so it can be shown once and reused under every expanded grammar point.
`.trim();

/**
 * @param {{
 *   sentence: string,
 *   contextBefore?: string,
 *   contextAfter?: string,
 *   explanationMode: 'beginner'|'intermediate'|'advanced',
 *   responseLanguage?: string,
 *   instructionOverride?: string,
 *   categories: {particles: boolean, conjugations: boolean, auxVerbs: boolean, slang: boolean}
 * }} params
 * @returns {string}
 */
export function buildExplanationPrompt({
  sentence,
  contextBefore = '',
  contextAfter = '',
  explanationMode = 'beginner',
  responseLanguage = 'English',
  instructionOverride = '',
  categories = {particles: true, conjugations: true, auxVerbs: true, slang: true},
}) {
  const modeInstructions = {
    beginner: 'Write meaning/formation/nuance for a JLPT N5-N4 learner. Avoid jargon; define any grammar term you use.',
    intermediate: 'Write meaning/formation/nuance for a JLPT N3-N2 learner. Standard grammar terminology is fine.',
    advanced: 'Write meaning/formation/nuance for a JLPT N1 / near-native learner. Include subtle nuance and register detail.',
  };

  const parts = [
    `Analyze this Japanese sentence for a language learner. ${modeInstructions[explanationMode] ?? modeInstructions.beginner}`,
    `Respond in ${responseLanguage} for all explanation text (Japanese fragments themselves stay in Japanese).`,
    '',
    `Sentence to explain: ${sentence}`,
  ];

  if (contextBefore) parts.push(`Preceding sentence (context only, do not re-explain it): ${contextBefore}`);
  if (contextAfter) parts.push(`Following sentence (context only, do not re-explain it): ${contextAfter}`);
  if (instructionOverride) parts.push(`Additional instruction: ${instructionOverride}`);

  parts.push('', buildCategoryInstruction(categories));
  parts.push('', RESPONSE_SCHEMA_DESCRIPTION);

  return parts.join('\n');
}
