import { describe, expect, it } from "vitest";
import { createCodeChallenge, createCodeVerifier } from "./oauth";

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
