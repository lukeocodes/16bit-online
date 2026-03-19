import { describe, it, expect } from "vitest";

/**
 * Test the character validation rules from characters.ts.
 * These are extracted here since the actual route handler is coupled
 * to Fastify and Drizzle. We test the validation logic directly.
 */

const VALID_RACES = new Set(["human", "elf", "dwarf"]);
const VALID_GENDERS = new Set(["male", "female"]);
const VALID_SKILLS = new Set([
  "swordsmanship", "archery", "magery", "mining", "lumberjacking",
  "tailoring", "blacksmithing", "alchemy", "fishing", "healing",
  "stealth", "musicianship", "cooking", "carpentry", "taming",
]);
const NAME_RE = /^[a-zA-Z][a-zA-Z0-9 ]{1,18}[a-zA-Z0-9]$/;

describe("character validation", () => {
  describe("NAME_RE", () => {
    it("accepts valid names", () => {
      expect(NAME_RE.test("Gandalf")).toBe(true);
      expect(NAME_RE.test("Sir Lancelot")).toBe(true);
      expect(NAME_RE.test("Player123")).toBe(true);
      expect(NAME_RE.test("ab1")).toBe(true); // min 3 chars
    });

    it("requires starting with a letter", () => {
      expect(NAME_RE.test("1Player")).toBe(false);
      expect(NAME_RE.test(" Player")).toBe(false);
    });

    it("requires ending with alphanumeric", () => {
      expect(NAME_RE.test("Player ")).toBe(false);
    });

    it("rejects too short names", () => {
      expect(NAME_RE.test("ab")).toBe(false);
      expect(NAME_RE.test("a")).toBe(false);
      expect(NAME_RE.test("")).toBe(false);
    });

    it("rejects too long names (>20 chars)", () => {
      expect(NAME_RE.test("a".repeat(21))).toBe(false);
    });

    it("allows exactly 20 characters", () => {
      // Start letter + 18 middle chars + end alphanumeric = 20
      expect(NAME_RE.test("A" + "b".repeat(18) + "c")).toBe(true);
    });

    it("rejects special characters", () => {
      expect(NAME_RE.test("Player@")).toBe(false);
      expect(NAME_RE.test("Play-er")).toBe(false);
      expect(NAME_RE.test("Play_er")).toBe(false);
    });
  });

  describe("VALID_RACES", () => {
    it("accepts all valid races", () => {
      expect(VALID_RACES.has("human")).toBe(true);
      expect(VALID_RACES.has("elf")).toBe(true);
      expect(VALID_RACES.has("dwarf")).toBe(true);
    });

    it("rejects invalid races", () => {
      expect(VALID_RACES.has("orc")).toBe(false);
      expect(VALID_RACES.has("Human")).toBe(false); // case-sensitive
    });

    it("has exactly 3 races", () => {
      expect(VALID_RACES.size).toBe(3);
    });
  });

  describe("VALID_GENDERS", () => {
    it("accepts valid genders", () => {
      expect(VALID_GENDERS.has("male")).toBe(true);
      expect(VALID_GENDERS.has("female")).toBe(true);
    });

    it("has exactly 2 options", () => {
      expect(VALID_GENDERS.size).toBe(2);
    });
  });

  describe("VALID_SKILLS", () => {
    it("has 15 skills", () => {
      expect(VALID_SKILLS.size).toBe(15);
    });

    it("includes expected skills", () => {
      expect(VALID_SKILLS.has("swordsmanship")).toBe(true);
      expect(VALID_SKILLS.has("archery")).toBe(true);
      expect(VALID_SKILLS.has("magery")).toBe(true);
      expect(VALID_SKILLS.has("mining")).toBe(true);
      expect(VALID_SKILLS.has("healing")).toBe(true);
      expect(VALID_SKILLS.has("stealth")).toBe(true);
    });

    it("rejects unknown skills", () => {
      expect(VALID_SKILLS.has("flying")).toBe(false);
    });
  });

  describe("stat validation logic", () => {
    function validateStats(str: number, dex: number, int_stat: number): string | null {
      const total = str + dex + int_stat;
      if (total !== 30) return `Stats must total 30, got ${total}`;
      for (const [name, val] of [["STR", str], ["DEX", dex], ["INT", int_stat]] as const) {
        if (val < 5 || val > 20) return `${name} must be 5-20`;
      }
      return null;
    }

    it("accepts valid stat allocation (10/10/10)", () => {
      expect(validateStats(10, 10, 10)).toBeNull();
    });

    it("accepts min/max extremes (5/5/20)", () => {
      expect(validateStats(5, 5, 20)).toBeNull();
    });

    it("accepts all max-min combos", () => {
      expect(validateStats(20, 5, 5)).toBeNull();
      expect(validateStats(5, 20, 5)).toBeNull();
    });

    it("rejects total != 30", () => {
      expect(validateStats(10, 10, 11)).toBe("Stats must total 30, got 31");
      expect(validateStats(10, 10, 9)).toBe("Stats must total 30, got 29");
    });

    it("rejects stat below 5", () => {
      expect(validateStats(4, 6, 20)).toBe("STR must be 5-20");
      expect(validateStats(5, 4, 21)).toBe("DEX must be 5-20");
    });

    it("rejects stat above 20", () => {
      expect(validateStats(21, 5, 4)).toBe("STR must be 5-20");
    });

    it("rejects all zeros", () => {
      expect(validateStats(0, 0, 0)).toBe("Stats must total 30, got 0");
    });
  });

  describe("skill validation logic", () => {
    function validateSkills(skills: Array<{ name: string }>): string | null {
      if (!Array.isArray(skills) || skills.length !== 3) return "Must choose exactly 3 skills";
      const names = skills.map(s => s.name?.toLowerCase());
      if (new Set(names).size !== 3) return "Invalid or duplicate skills";
      if (!names.every(s => VALID_SKILLS.has(s))) return "Invalid or duplicate skills";
      return null;
    }

    it("accepts 3 valid unique skills", () => {
      expect(validateSkills([
        { name: "swordsmanship" },
        { name: "archery" },
        { name: "magery" },
      ])).toBeNull();
    });

    it("rejects fewer than 3 skills", () => {
      expect(validateSkills([{ name: "archery" }])).toBe("Must choose exactly 3 skills");
    });

    it("rejects more than 3 skills", () => {
      expect(validateSkills([
        { name: "archery" }, { name: "magery" },
        { name: "mining" }, { name: "healing" },
      ])).toBe("Must choose exactly 3 skills");
    });

    it("rejects duplicate skills", () => {
      expect(validateSkills([
        { name: "archery" }, { name: "archery" }, { name: "magery" },
      ])).toBe("Invalid or duplicate skills");
    });

    it("rejects unknown skills", () => {
      expect(validateSkills([
        { name: "archery" }, { name: "flying" }, { name: "magery" },
      ])).toBe("Invalid or duplicate skills");
    });
  });
});
