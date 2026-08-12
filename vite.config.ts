import { defineConfig, loadEnv } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig(({ command, mode }) => {
  const environment = loadEnv(mode, ".", "VITE_");
  const serviceNowBaseUrl = validateServiceNowBaseUrl(
    environment.VITE_SERVICE_NOW_BASE_URL,
  );
  const serviceNowClientId = validateServiceNowClientId(
    environment.VITE_SERVICE_NOW_CLIENT_ID,
  );
  const extensionName = validateExtensionName(environment.VITE_EXTENSION_NAME);
  const extensionKey = environment.VITE_EXTENSION_KEY?.trim();
  const isPreReleaseBuild = mode === "pre-release";
  const usesPreReleaseBranding = mode === "development" || isPreReleaseBuild;
  const extensionVersion = getExtensionVersion(
    manifest.version,
    isPreReleaseBuild,
  );
  const iconDirectory = usesPreReleaseBranding ? "icons/pre-release" : "icons";

  return {
    plugins: [
      crx({
        manifest: {
          ...manifest,
          name: extensionName,
          version: extensionVersion,
          key: extensionKey,
          icons: getIconPaths(iconDirectory),
          action: {
            ...manifest.action,
            default_icon: getIconPaths(iconDirectory),
            default_title: extensionName,
          },
          host_permissions: [`${serviceNowBaseUrl}/*`],
        },
      }),
    ],
    define: {
      "import.meta.env.VITE_SERVICE_NOW_BASE_URL":
        JSON.stringify(serviceNowBaseUrl),
      "import.meta.env.VITE_SERVICE_NOW_CLIENT_ID":
        JSON.stringify(serviceNowClientId),
    },
    server: {
      cors: true,
    },
    build: {
      outDir:
        command === "serve"
          ? "dist-dev"
          : isPreReleaseBuild
            ? "dist-pre-release"
            : "dist",
      emptyOutDir: true,
    },
  };
});

function getIconPaths(directory: string): Record<"16" | "48" | "128", string> {
  return {
    "16": `${directory}/icon16.png`,
    "48": `${directory}/icon48.png`,
    "128": `${directory}/icon128.png`,
  };
}

function validateExtensionName(value: string | undefined): string {
  const extensionName = value?.trim();
  if (!extensionName) {
    throw new Error("VITE_EXTENSION_NAME is required.");
  }

  return extensionName;
}

function getExtensionVersion(
  version: string,
  isPreReleaseBuild: boolean,
): string {
  if (!isPreReleaseBuild) {
    return version;
  }

  const normalizedVersion = version.match(/^(\d+)\.(\d+)\.(\d+)-rc\.(\d+)$/);
  if (!normalizedVersion) {
    return version;
  }

  return normalizedVersion.slice(1).join(".");
}

function validateServiceNowBaseUrl(value: string | undefined): string {
  if (!value) {
    throw new Error("VITE_SERVICE_NOW_BASE_URL is required.");
  }

  try {
    const parsedUrl = new URL(value);
    if (parsedUrl.protocol !== "https:" || parsedUrl.origin !== value) {
      throw new Error();
    }
  } catch {
    throw new Error(
      "VITE_SERVICE_NOW_BASE_URL must be an HTTPS origin without a path, query, hash, or trailing slash.",
    );
  }

  return value;
}

function validateServiceNowClientId(value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error("VITE_SERVICE_NOW_CLIENT_ID is required.");
  }

  return value.trim();
}
