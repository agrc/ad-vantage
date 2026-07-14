export interface PaginationAutomationCandidate {
  scopeKey: string;
  currentCount: number | null;
  highestEligibleCount: number | null;
  eligibleCounts: number[];
}

export interface PaginationAutomationAction {
  count: number;
  time: number;
}

export interface PaginationAutomationDecisionInput {
  candidate: PaginationAutomationCandidate;
  previousEligibleSignature: string | null;
  recentAction?: PaginationAutomationAction;
  defaultCount: number;
  cooldownMs: number;
  now: number;
}

export interface PaginationAutomationDecision {
  eligibleSignature: string | null;
  shouldClick: boolean;
}

export function decidePaginationAutomation(
  input: PaginationAutomationDecisionInput,
): PaginationAutomationDecision {
  const {
    candidate,
    previousEligibleSignature,
    recentAction,
    defaultCount,
    cooldownMs,
    now,
  } = input;

  const eligibleSignature = getEligiblePaginationSignature(
    candidate,
    defaultCount,
  );

  if (!eligibleSignature || candidate.highestEligibleCount === null) {
    return { eligibleSignature: null, shouldClick: false };
  }

  if (eligibleSignature === previousEligibleSignature) {
    return { eligibleSignature, shouldClick: false };
  }

  if (
    recentAction &&
    recentAction.count === candidate.highestEligibleCount &&
    now - recentAction.time < cooldownMs
  ) {
    return { eligibleSignature, shouldClick: false };
  }

  return { eligibleSignature, shouldClick: true };
}

export function getEligiblePaginationSignature(
  candidate: PaginationAutomationCandidate,
  defaultCount: number,
): string | null {
  if (candidate.currentCount !== defaultCount) {
    return null;
  }

  if (
    candidate.highestEligibleCount === null ||
    candidate.highestEligibleCount === candidate.currentCount
  ) {
    return null;
  }

  return [
    candidate.scopeKey,
    `current:${candidate.currentCount}`,
    `target:${candidate.highestEligibleCount}`,
    `eligible:${candidate.eligibleCounts.join(",")}`,
  ].join("|");
}