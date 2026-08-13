import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTimeWarnings, isTimeEntryWarningGrid } from "./time-warnings";

function createGrid(): {
  grid: HTMLTableElement;
  headerRow: HTMLTableRowElement;
} {
  const grid = document.createElement("table");
  grid.innerHTML = `
    <thead><tr>
      <th data-qa="DLY_ACTV_CD">Daily Activity</th>
      <th data-qa="EVENT_CD">Event</th>
      <th data-qa="DAY_1_TIME_TOT"><span data-qa-id="grid.headerCellTitle">Mon 07/27</span></th>
    </tr></thead>
    <tbody><tr>
      <td>Task</td>
      <td data-cell="event"><input value=""><span>Search and Select Event</span></td>
      <td data-cell="mon"><input value="1:10"></td>
    </tr></tbody>
  `;
  return { grid, headerRow: grid.querySelector("thead tr")! };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("time warnings", () => {
  it("warns for non-quarter-hour time and a missing event", () => {
    const { grid, headerRow } = createGrid();

    expect(isTimeEntryWarningGrid(grid, headerRow)).toBe(true);
    applyTimeWarnings(grid, headerRow);

    expect(grid.querySelector('[data-cell="mon"]')?.classList).toContain(
      "adv-time-warn",
    );
    expect(grid.querySelector('[data-cell="event"]')?.classList).toContain(
      "adv-missing-event-warn",
    );
  });

  it("warns when an unselected Event cell renders as a dash", () => {
    const { grid, headerRow } = createGrid();
    const eventCell = grid.querySelector<HTMLElement>('[data-cell="event"]')!;
    eventCell.innerHTML = "<span>-</span>";

    applyTimeWarnings(grid, headerRow);

    expect(eventCell.classList).toContain("adv-missing-event-warn");
  });

  it("uses text content for a read-only Event cell", () => {
    const { grid, headerRow } = createGrid();
    grid.querySelector('[data-cell="event"]')!.innerHTML = "<span>TW</span>";

    applyTimeWarnings(grid, headerRow);

    expect(grid.querySelector('[data-cell="event"]')?.classList).not.toContain(
      "adv-missing-event-warn",
    );
  });

  it("refreshes warning state after blur", async () => {
    vi.useFakeTimers();
    const { grid, headerRow } = createGrid();
    applyTimeWarnings(grid, headerRow);
    const timeInput = grid.querySelector<HTMLInputElement>(
      '[data-cell="mon"] input',
    )!;

    timeInput.value = "1:15";
    timeInput.dispatchEvent(new Event("blur"));
    await vi.runAllTimersAsync();

    expect(grid.querySelector('[data-cell="mon"]')?.classList).not.toContain(
      "adv-time-warn",
    );
  });

  it("clears warnings when the grid is excluded", () => {
    const { grid, headerRow } = createGrid();
    const timeCell = grid.querySelector<HTMLElement>('[data-cell="mon"]')!;
    timeCell.classList.add("adv-time-warn");
    headerRow.children[0].setAttribute("data-qa", "PY_PRD_AM");

    applyTimeWarnings(grid, headerRow);

    expect(timeCell.classList).not.toContain("adv-time-warn");
  });
});
