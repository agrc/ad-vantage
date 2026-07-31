import { describe, expect, it, vi } from "vitest";
import {
  createPaginationAutomationController,
  parsePaginationCount,
} from "./pagination";

describe("parsePaginationCount", () => {
  it.each([
    ['<button data-qa-id="grid.pagination.100Records"></button>', 100],
    ['<button aria-label="50 records per page, 1 of 2"></button>', 50],
    ["<button>20</button>", 20],
    ["<button>Next</button>", null],
  ])("parses pagination metadata from %s", (markup, expected) => {
    const container = document.createElement("div");
    container.innerHTML = markup;
    expect(parsePaginationCount(container.querySelector("button")!)).toBe(
      expected,
    );
  });
});

describe("pagination automation controller", () => {
  it("clicks the highest option once for a verified fallback state", () => {
    document.body.innerHTML = `
      <section>
        <div role="grid"><table><thead><tr><th data-qa="EVENT">Event</th></tr></thead></table></div>
        <button data-qa-id="daily.pagination.20Records" aria-current="true">20</button>
        <button data-qa-id="daily.pagination.50Records">50</button>
        <button data-qa-id="daily.pagination.100Records">100</button>
      </section>
    `;
    const grid = document.querySelector<HTMLElement>('[role="grid"]')!;
    const highest = document.querySelector<HTMLButtonElement>(
      '[data-qa-id$="100Records"]',
    )!;
    const click = vi.spyOn(highest, "click");
    const controller = createPaginationAutomationController({
      isVisible: () => true,
      now: () => 10_000,
    });

    controller.sync(grid);
    controller.sync(grid);

    expect(click).toHaveBeenCalledOnce();
  });
});
