const PRE_RELEASE_ONLY_HOST_MATCH = "https://vantage-ma1.utah.gov/*";

export function getContentScriptsForBuild<
  T extends { matches: string[] },
>(
  contentScripts: T[],
  buildTarget: "development" | "pre-release" | "production",
) {
  return contentScripts.map((contentScript) => ({
    ...contentScript,
    matches:
      buildTarget === "production"
        ? contentScript.matches
        : [...contentScript.matches, PRE_RELEASE_ONLY_HOST_MATCH],
  }));
}
