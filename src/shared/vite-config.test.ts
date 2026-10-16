import { describe, expect, it } from "vitest";
import { getContentScriptsForBuild } from "./content-scripts";

const MA1_HOST_MATCH = "https://vantage-ma1.utah.gov/*";
const CONTENT_SCRIPTS = [
  {
    matches: [
      "https://vantage.utah.gov/*",
      "https://vantage.access.utah.gov/*",
    ],
  },
];

describe("build content script hosts", () => {
  it("includes the MA1 host in development and pre-release builds", () => {
    for (const buildTarget of ["development", "pre-release"] as const) {
      const matches = getContentScriptsForBuild(
        CONTENT_SCRIPTS,
        buildTarget,
      ).flatMap((contentScript) => contentScript.matches);

      expect(matches).toContain(MA1_HOST_MATCH);
    }
  });

  it("excludes the MA1 host from production builds", () => {
    const matches = getContentScriptsForBuild(
      CONTENT_SCRIPTS,
      "production",
    ).flatMap((contentScript) => contentScript.matches);

    expect(matches).not.toContain(MA1_HOST_MATCH);
  });
});
