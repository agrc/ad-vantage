import { describe, expect, it, vi } from "vitest";
import {
  createColumnPrefsWriter,
  setColumnFrozen,
  setColumnVisibility,
} from "./column-prefs";

describe("column preference transitions", () => {
  it("updates visibility without mutating the prior preferences", () => {
    const prefs = { hidden: ["EVENT"], frozen: ["DLY_ACTV_CD"] };

    const next = setColumnVisibility(prefs, "EVENT", true);

    expect(next).toEqual({ hidden: [], frozen: ["DLY_ACTV_CD"] });
    expect(prefs.hidden).toEqual(["EVENT"]);
  });

  it("freezes Daily Activity with Description", () => {
    expect(
      setColumnFrozen({ hidden: [], frozen: [] }, "adv-description", true)
        .frozen,
    ).toEqual(["DLY_ACTV_CD", "adv-description"]);
  });

  it("unfreezes Description when Daily Activity is unfrozen", () => {
    expect(
      setColumnFrozen(
        { hidden: [], frozen: ["DLY_ACTV_CD", "adv-description", "EVENT"] },
        "DLY_ACTV_CD",
        false,
      ).frozen,
    ).toEqual(["EVENT"]);
  });
});

describe("column preference writer", () => {
  it("persists rapid changes in order", async () => {
    const persisted: string[][] = [];
    const writer = createColumnPrefsWriter(async (prefs) => {
      persisted.push(prefs.hidden);
    });

    await Promise.all([
      writer.write({ hidden: ["EVENT"], frozen: [] }),
      writer.write({ hidden: ["EVENT", "CODING"], frozen: [] }),
    ]);

    expect(persisted).toEqual([["EVENT"], ["EVENT", "CODING"]]);
  });

  it("continues after a failed write", async () => {
    const persist = vi
      .fn<(prefs: { hidden: string[]; frozen: string[] }) => Promise<void>>()
      .mockRejectedValueOnce(new Error("sync unavailable"))
      .mockResolvedValueOnce(undefined);
    const writer = createColumnPrefsWriter(persist);

    await expect(
      writer.write({ hidden: ["EVENT"], frozen: [] }),
    ).rejects.toThrow("sync unavailable");
    await expect(
      writer.write({ hidden: ["CODING"], frozen: [] }),
    ).resolves.toBeUndefined();

    expect(persist).toHaveBeenCalledTimes(2);
  });
});
