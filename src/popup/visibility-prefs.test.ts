import { describe, expect, it, vi } from "vitest";
import { createPrefsWriter, setVisibility } from "./visibility-prefs";

describe("setVisibility", () => {
  it("removes key from hidden when visible is true", () => {
    const prefs = { hidden: ["colA", "colB"], frozen: ["colA"] };
    const next = setVisibility(prefs, "colA", true);

    expect(next).toEqual({ hidden: ["colB"], frozen: ["colA"] });
    expect(prefs.hidden).toEqual(["colA", "colB"]);
  });

  it("adds key to hidden when visible is false", () => {
    const prefs = { hidden: ["colB"] };
    const next = setVisibility(prefs, "colA", false);

    expect(next).toEqual({ hidden: ["colB", "colA"] });
  });

  it("does not duplicate key if already hidden", () => {
    const prefs = { hidden: ["colA"] };
    const next = setVisibility(prefs, "colA", false);

    expect(next).toEqual({ hidden: ["colA"] });
  });
});

describe("createPrefsWriter", () => {
  it("persists writes in serial order", async () => {
    const persisted: string[][] = [];
    const writer = createPrefsWriter(async (prefs: { hidden: string[] }) => {
      persisted.push(prefs.hidden);
    });

    await Promise.all([
      writer.write({ hidden: ["colA"] }),
      writer.write({ hidden: [] }),
    ]);

    expect(persisted).toEqual([["colA"], []]);
  });

  it("continues processing writes after a rejection", async () => {
    const persist = vi
      .fn<(prefs: { hidden: string[] }) => Promise<void>>()
      .mockRejectedValueOnce(new Error("sync unavailable"))
      .mockResolvedValueOnce(undefined);
    const writer = createPrefsWriter(persist);

    await expect(writer.write({ hidden: ["colA"] })).rejects.toThrow("sync unavailable");
    await expect(writer.write({ hidden: [] })).resolves.toBeUndefined();
  });
});
