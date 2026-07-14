import { describe, expect, it } from "vitest";
import {
  decidePaginationAutomation,
  getEligiblePaginationSignature,
  type PaginationAutomationCandidate,
} from "./pagination-automation";

const defaultCount = 20;
const cooldownMs = 1500;
const now = 10_000;

function createCandidate(
  overrides: Partial<PaginationAutomationCandidate> = {},
): PaginationAutomationCandidate {
  return {
    scopeKey: "daily-activity-grid",
    currentCount: 20,
    highestEligibleCount: 100,
    eligibleCounts: [50, 100],
    ...overrides,
  };
}

describe("getEligiblePaginationSignature", () => {
  it("returns a stable signature for verified fallback states", () => {
    expect(
      getEligiblePaginationSignature(createCandidate(), defaultCount),
    ).toBe(
      "daily-activity-grid|current:20|target:100|eligible:50,100",
    );
  });

  it("returns null when the grid is not on the default fallback count", () => {
    expect(
      getEligiblePaginationSignature(
        createCandidate({ currentCount: 50, highestEligibleCount: 100 }),
        defaultCount,
      ),
    ).toBeNull();
  });
});

describe("decidePaginationAutomation", () => {
  it("clicks once when the grid first enters an eligible fallback state", () => {
    expect(
      decidePaginationAutomation({
        candidate: createCandidate(),
        previousEligibleSignature: null,
        defaultCount,
        cooldownMs,
        now,
      }),
    ).toEqual({
      eligibleSignature:
        "daily-activity-grid|current:20|target:100|eligible:50,100",
      shouldClick: true,
    });
  });

  it("does not click again for repeated reevaluation of the same state", () => {
    const signature = getEligiblePaginationSignature(
      createCandidate(),
      defaultCount,
    );

    expect(
      decidePaginationAutomation({
        candidate: createCandidate(),
        previousEligibleSignature: signature,
        defaultCount,
        cooldownMs,
        now,
      }).shouldClick,
    ).toBe(false);
  });

  it("does not click when the current page size is not the verified fallback", () => {
    expect(
      decidePaginationAutomation({
        candidate: createCandidate({ currentCount: 50, highestEligibleCount: 100 }),
        previousEligibleSignature: null,
        defaultCount,
        cooldownMs,
        now,
      }).shouldClick,
    ).toBe(false);
  });

  it("allows one fresh click after the grid leaves and later re-enters fallback state", () => {
    const initial = decidePaginationAutomation({
      candidate: createCandidate(),
      previousEligibleSignature: null,
      defaultCount,
      cooldownMs,
      now,
    });
    const resetState = decidePaginationAutomation({
      candidate: createCandidate({ currentCount: 100, highestEligibleCount: 100 }),
      previousEligibleSignature: initial.eligibleSignature,
      defaultCount,
      cooldownMs,
      now: now + cooldownMs + 1,
    });
    const reentered = decidePaginationAutomation({
      candidate: createCandidate(),
      previousEligibleSignature: resetState.eligibleSignature,
      defaultCount,
      cooldownMs,
      now: now + cooldownMs + 2,
    });

    expect(initial.shouldClick).toBe(true);
    expect(resetState.eligibleSignature).toBeNull();
    expect(reentered.shouldClick).toBe(true);
  });

  it("suppresses rapid follow-up clicks even if the eligible signature changes", () => {
    expect(
      decidePaginationAutomation({
        candidate: createCandidate({ eligibleCounts: [100] }),
        previousEligibleSignature: "daily-activity-grid|current:20|target:50|eligible:50",
        recentAction: { count: 100, time: now - 200 },
        defaultCount,
        cooldownMs,
        now,
      }).shouldClick,
    ).toBe(false);
  });
});