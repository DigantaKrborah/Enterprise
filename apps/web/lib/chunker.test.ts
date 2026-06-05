import { describe, it, expect } from "vitest";
import { chunkText, chunkPages } from "./chunker";

const SHORT = "This is a short document. It has two sentences.";
// Each sentence is ~1200 chars; two sentences exceed the 2000-char target → forces 2+ chunks
const LONG = "A ".repeat(600) + "B. " + "C ".repeat(600) + "D. " + "E ".repeat(600) + "F.";

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    const chunks = chunkText(SHORT);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].content).toContain("short document");
  });

  it("splits long text into multiple chunks", () => {
    const chunks = chunkText(LONG);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("assigns sequential chunkIndex values", () => {
    const chunks = chunkText(LONG);
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });

  it("each chunk is within the target size (with some slack for overlap)", () => {
    const chunks = chunkText(LONG);
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(2300); // 2000 + overlap slack
    }
  });

  it("attaches pageNumber when provided", () => {
    const chunks = chunkText(SHORT, 3);
    expect(chunks[0].pageNumber).toBe(3);
  });

  it("returns empty array for empty input", () => {
    expect(chunkText("")).toHaveLength(0);
    expect(chunkText("   ")).toHaveLength(0);
  });

  it("consecutive chunks share overlap content", () => {
    const chunks = chunkText(LONG);
    if (chunks.length < 2) return;
    // The tail of chunk N should partially appear in chunk N+1
    const tailOfFirst = chunks[0].content.slice(-100);
    expect(chunks[1].content).toContain(tailOfFirst.slice(0, 50).trim().split(" ")[0]);
  });
});

describe("chunkPages", () => {
  it("increments chunkIndex globally across pages", () => {
    const pages = [
      { text: SHORT, pageNumber: 1 },
      { text: SHORT, pageNumber: 2 },
    ];
    const chunks = chunkPages(pages);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[1].chunkIndex).toBe(1);
  });
});
