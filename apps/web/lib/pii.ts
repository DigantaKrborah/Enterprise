// PII scanner — detect and mask sensitive data before storing or sending to cloud LLMs.
// Patterns cover the most common PII found in HR and Operations documents.

const PATTERNS: { name: string; regex: RegExp; mask: string }[] = [
  { name: "SSN",         regex: /\b\d{3}-\d{2}-\d{4}\b/g,                                                      mask: "[SSN]" },
  { name: "credit_card", regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,                                 mask: "[CARD]" },
  { name: "phone_us",    regex: /\b(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,                      mask: "[PHONE]" },
  { name: "email",       regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,                      mask: "[EMAIL]" },
  { name: "passport",    regex: /\b[A-Z]{1,2}[0-9]{6,9}\b/g,                                                    mask: "[PASSPORT]" },
  { name: "ip_address",  regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,                                                 mask: "[IP]" },
];

export interface PIIScanResult {
  maskedText: string;
  hasPII: boolean;
  detectedTypes: string[];
}

export function scanAndMaskPII(text: string): PIIScanResult {
  let maskedText = text;
  const detectedTypes: string[] = [];

  for (const { name, regex, mask } of PATTERNS) {
    regex.lastIndex = 0; // reset stateful regex
    if (regex.test(maskedText)) {
      detectedTypes.push(name);
      regex.lastIndex = 0;
      maskedText = maskedText.replace(regex, mask);
    }
  }

  return { maskedText, hasPII: detectedTypes.length > 0, detectedTypes };
}

// Lightweight check — returns true if PII is detected, without masking.
// Use before deciding whether to send to cloud LLM.
export function containsPII(text: string): boolean {
  return PATTERNS.some(({ regex }) => {
    regex.lastIndex = 0;
    return regex.test(text);
  });
}
