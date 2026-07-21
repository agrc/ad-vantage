import {
  clearAuthToken,
  getAuthToken,
  setAuthToken,
  type AuthTokenRecord,
} from "../shared/storage";

export const SERVICE_NOW_BASE_URL = "https://utahdev.servicenowservices.com";
export const SERVICE_NOW_CLIENT_ID = "8982c05b2d9e418ba33f64dcd6a983d5";
const TOKEN_PATH = "/oauth_token.do";
const REFRESH_WINDOW_MS = 60_000;

let refreshPromise: Promise<string> | null = null;

export async function authenticate(): Promise<string> {
  const verifier = createCodeVerifier();
  const challenge = await createCodeChallenge(verifier);
  const state = createCodeVerifier();
  const redirectUri = chrome.identity.getRedirectURL();
  const authorizeUrl = new URL(`${SERVICE_NOW_BASE_URL}/oauth_auth.do`);
  authorizeUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: SERVICE_NOW_CLIENT_ID,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  }).toString();

  const responseUrl = await launchWebAuthFlow({
    url: authorizeUrl.toString(),
    interactive: true,
  });
  const response = new URL(responseUrl);
  if (response.searchParams.get("state") !== state) {
    throw new Error("ServiceNow authentication state did not match.");
  }

  const error = response.searchParams.get("error");
  if (error) {
    throw new Error(
      response.searchParams.get("error_description") ??
        `ServiceNow authentication failed: ${error}`,
    );
  }

  const code = response.searchParams.get("code");
  if (!code)
    throw new Error("ServiceNow did not return an authorization code.");

  const token = await exchangeToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: SERVICE_NOW_CLIENT_ID,
    code_verifier: verifier,
  });
  await setAuthToken(token);
  return token.accessToken;
}

export async function getValidAccessToken(): Promise<string> {
  const token = await getAuthToken();
  if (!token) return authenticate();
  if (token.expiresAt > Date.now() + REFRESH_WINDOW_MS) {
    return token.accessToken;
  }

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(token).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function signOut(): Promise<void> {
  await clearAuthToken();
}

export function createCodeVerifier(randomValues?: Uint8Array): string {
  const bytes = randomValues ?? crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(bytes);
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64UrlEncode(new Uint8Array(digest));
}

async function refreshAccessToken(token: AuthTokenRecord): Promise<string> {
  try {
    const refreshed = await exchangeToken({
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
      client_id: SERVICE_NOW_CLIENT_ID,
    });
    await setAuthToken(refreshed);
    return refreshed.accessToken;
  } catch (error) {
    await clearAuthToken();
    throw error;
  }
}

async function exchangeToken(
  parameters: Record<string, string>,
): Promise<AuthTokenRecord> {
  const response = await fetch(`${SERVICE_NOW_BASE_URL}${TOKEN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(parameters),
  });
  if (!response.ok) {
    throw new Error(`ServiceNow token exchange failed (${response.status}).`);
  }

  const payload = (await response.json()) as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
  };
  if (
    typeof payload.access_token !== "string" ||
    typeof payload.refresh_token !== "string"
  ) {
    throw new Error("ServiceNow returned an invalid token response.");
  }

  const expiresIn =
    typeof payload.expires_in === "number" ? payload.expires_in : 1800;
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

function launchWebAuthFlow(
  details: chrome.identity.WebAuthFlowDetails,
): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(details, (responseUrl) => {
      const error = chrome.runtime.lastError;
      if (error || !responseUrl) {
        reject(
          new Error(
            error?.message ?? "ServiceNow authentication was cancelled.",
          ),
        );
        return;
      }
      resolve(responseUrl);
    });
  });
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
