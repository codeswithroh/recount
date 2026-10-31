const INJECTION_PATTERNS = [
  /\b(ignore|disregard|forget|override)\b.{0,40}\b(previous|prior|above|earlier|system|your)\b.{0,20}\b(instructions?|prompts?|rules?)\b/i,
  /\b(system prompt|developer message)\b/i,
  /\b(you are now|act as|pretend to be)\b.{0,40}\b(assistant|model|analyst|ai)\b/i,
  /\b(mark|rate|label|return|output|set)\b.{0,50}\b(verdict|claim)\b.{0,30}\b(as )?(reproduced|true|verified|correct)\b/i,
  /\b(found_data|definition_match|claimed_value)\b/i,
];

// Pasted claims and fetched pages are untrusted, so they are checked before any model reads them.
export const findInjection = (text: string) => INJECTION_PATTERNS.find((pattern) => pattern.test(text));
