import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAuthToken, getAuthToken, setAuthToken } from "../shared/storage";
import {
  SERVICE_NOW_BASE_URL,
  SERVICE_NOW_CLIENT_ID,
  authenticate,
  createCodeChallenge,
  createCodeVerifier,
  getValidAccessToken,
  signOut,
} from "./oauth";

vi.mock("../shared/storage", () => ({
  clearAuthToken: vi.fn(),
  getAuthToken: vi.fn(),
  setAuthToken: vi.fn(),
}));

const runtime: { lastError?: { message: string } } = {};
const launchWebAuthFlow = vi.fn();

vi.stubGlobal("chrome", {
  identity: {
    getRedirectURL: () => "https://extension.chromiumapp.org/",
    launchWebAuthFlow,
  },
  runtime,
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  runtime.lastError = undefined;
  vi.mocked(getAuthToken).mockReset().mockResolvedValue(null);
  vi.mocked(setAuthToken).mockReset().mockResolvedValue(undefined);
  vi.mocked(clearAuthToken).mockReset().mockResolvedValue(undefined);
});

function completeAuthorization(response?: {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
}) {
  launchWebAuthFlow.mockImplementation((details, callback) => {
    const authorizeUrl = new URL(details.url);
    const state = authorizeUrl.searchParams.get("state");
    callback(`https://extension.chromiumapp.org/?code=code&state=${state}`);
  });
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json(
      response ?? {
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 1800,
      },
    ),
  );
}

describe("PKCE helpers", () => {
  it("creates a URL-safe verifier from random bytes", () => {
    expect(createCodeVerifier(new Uint8Array([255, 0, 1, 62]))).toBe("_wABPg");
  });

  it("creates the RFC 7636 S256 challenge", async () => {
    await expect(
      createCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    ).resolves.toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("authentication coordination", () => {
  it("uses the selected environment for authorization and token exchange", async () => {
    const fetchMock = completeAuthorization();

    await authenticate();

    expect(SERVICE_NOW_BASE_URL).toBe("https://test.servicenow.example");
    expect(SERVICE_NOW_CLIENT_ID).toBe("test-client-id");

    const authorizeUrl = new URL(launchWebAuthFlow.mock.calls[0][0].url);
    expect(authorizeUrl.origin).toBe(SERVICE_NOW_BASE_URL);
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      SERVICE_NOW_CLIENT_ID,
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${SERVICE_NOW_BASE_URL}/oauth_token.do`,
    );
    const tokenRequest = new URLSearchParams(
      String(fetchMock.mock.calls[0][1]?.body),
    );
    expect(tokenRequest.get("client_id")).toBe(SERVICE_NOW_CLIENT_ID);
  });

  it("shares one interactive flow between concurrent callers", async () => {
    completeAuthorization();

    await expect(
      Promise.all([getValidAccessToken(), getValidAccessToken()]),
    ).resolves.toEqual(["access-token", "access-token"]);

    expect(launchWebAuthFlow).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
    expect(setAuthToken).toHaveBeenCalledOnce();
  });

  it("clears failed authentication state for a later retry", async () => {
    launchWebAuthFlow.mockImplementationOnce((_details, callback) => {
      runtime.lastError = { message: "User cancelled" };
      callback();
      runtime.lastError = undefined;
    });

    await expect(authenticate()).rejects.toThrow("User cancelled");

    completeAuthorization();
    await expect(authenticate()).resolves.toBe("access-token");
    expect(launchWebAuthFlow).toHaveBeenCalledTimes(2);
  });

  it("clears credentials after an in-flight authentication settles", async () => {
    completeAuthorization();
    const authentication = authenticate();

    await signOut();

    await expect(authentication).resolves.toBe("access-token");
    expect(setAuthToken).toHaveBeenCalledBefore(vi.mocked(clearAuthToken));
    expect(clearAuthToken).toHaveBeenCalledOnce();
  });

  it("accepts numeric-string token expirations", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    completeAuthorization({
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: "90",
    });

    await authenticate();

    expect(setAuthToken).toHaveBeenCalledWith({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: 1_090_000,
    });
    now.mockRestore();
  });
});
