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
  it("excludes the MA1 host from production and keeps it in pre-release", () => {
    const productionMatches = getContentScriptsForBuild(
      CONTENT_SCRIPTS,
      false,
    ).flatMap(
      (contentScript) => contentScript.matches,
    );
    const preReleaseMatches = getContentScriptsForBuild(
      CONTENT_SCRIPTS,
      true,
    ).flatMap(
      (contentScript) => contentScript.matches,
    );

    expect(productionMatches).not.toContain(MA1_HOST_MATCH);
    expect(preReleaseMatches).toContain(MA1_HOST_MATCH);
  });
});
