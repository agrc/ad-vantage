import { defineConfig, loadEnv } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig(({ command, mode }) => {
  const environment = loadEnv(mode, ".", "VITE_SERVICE_NOW_");
  const serviceNowBaseUrl = validateServiceNowBaseUrl(
    environment.VITE_SERVICE_NOW_BASE_URL,
  );
  const serviceNowClientId = validateServiceNowClientId(
    environment.VITE_SERVICE_NOW_CLIENT_ID,
  );

  return {
    plugins: [
      crx({
        manifest: {
          ...manifest,
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
      outDir: command === "serve" ? "dist-dev" : "dist",
      emptyOutDir: true,
    },
  };
});

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
