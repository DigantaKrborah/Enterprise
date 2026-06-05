import { describe, it, expect } from "vitest";
import { scanAndMaskPII, containsPII } from "./pii";

describe("scanAndMaskPII", () => {
  it("masks SSN", () => {
    const { maskedText, hasPII, detectedTypes } = scanAndMaskPII("ID: 123-45-6789 is the SSN.");
    expect(maskedText).toBe("ID: [SSN] is the SSN.");
    expect(hasPII).toBe(true);
    expect(detectedTypes).toContain("SSN");
  });

  it("masks email addresses", () => {
    const { maskedText, hasPII } = scanAndMaskPII("Contact admin@nrl.co for help.");
    expect(maskedText).toContain("[EMAIL]");
    expect(hasPII).toBe(true);
  });

  it("masks US phone numbers", () => {
    const { maskedText, hasPII } = scanAndMaskPII("Call us at 555-867-5309 anytime.");
    expect(maskedText).toContain("[PHONE]");
    expect(hasPII).toBe(true);
  });

  it("masks credit card numbers", () => {
    const { maskedText, hasPII } = scanAndMaskPII("Card: 4111 1111 1111 1111");
    expect(maskedText).toContain("[CARD]");
    expect(hasPII).toBe(true);
  });

  it("returns hasPII=false for clean text", () => {
    const { hasPII, detectedTypes, maskedText } = scanAndMaskPII(
      "The CDU startup SOP requires a 5-minute purge before feed introduction."
    );
    expect(hasPII).toBe(false);
    expect(detectedTypes).toHaveLength(0);
    expect(maskedText).toContain("CDU startup SOP");
  });

  it("masks multiple PII types in one pass", () => {
    const { detectedTypes } = scanAndMaskPII(
      "SSN: 999-99-9999, email: a@b.com, phone: 800-555-1234"
    );
    expect(detectedTypes).toContain("SSN");
    expect(detectedTypes).toContain("email");
    expect(detectedTypes).toContain("phone_us");
  });

  it("does not mutate the original text", () => {
    const original = "SSN: 123-45-6789";
    scanAndMaskPII(original);
    expect(original).toBe("SSN: 123-45-6789");
  });
});

describe("containsPII", () => {
  it("returns true for text with SSN", () => {
    expect(containsPII("SSN: 123-45-6789")).toBe(true);
  });

  it("returns false for clean text", () => {
    expect(containsPII("Normal operational procedure text.")).toBe(false);
  });
});
