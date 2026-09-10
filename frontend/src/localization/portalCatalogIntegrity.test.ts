import { describe, expect, it } from "vitest";
import sourcePhrases from "./generated/source-phrases.json";

const modules = import.meta.glob<Record<string, string>>([
  "./generated/*.json",
  "!./generated/source-phrases.json",
  "!./generated/*.partial.json",
], {
  eager: true,
  import: "default",
});

const catalogs = Object.entries(modules).filter(([path]) => !path.endsWith("source-phrases.json"));

describe("generated portal translation catalogs", () => {
  it("keeps every generated locale aligned with the complete source phrase inventory", () => {
    const expected = [...sourcePhrases].sort();
    expect(expected).toHaveLength(1959);
    expect(catalogs).toHaveLength(17);
    for (const [, catalog] of catalogs) {
      expect(Object.keys(catalog).sort()).toEqual(expected);
      for (const phrase of expected) expect(catalog[phrase]?.trim()).not.toBe("");
    }
  });
});
