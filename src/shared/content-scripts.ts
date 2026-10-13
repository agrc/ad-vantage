const PRE_RELEASE_ONLY_HOST_MATCH = "https://vantage-ma1.utah.gov/*";

export function getContentScriptsForBuild<
  T extends { matches: string[] },
>(contentScripts: T[], isPreReleaseBuild: boolean) {
  return contentScripts.map((contentScript) => ({
    ...contentScript,
    matches: isPreReleaseBuild
      ? [...contentScript.matches, PRE_RELEASE_ONLY_HOST_MATCH]
      : contentScript.matches,
  }));
}
