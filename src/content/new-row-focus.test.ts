import { afterEach, describe, expect, it, vi } from "vitest";
import { createDailyActivityRowFocusController } from "./new-row-focus";

function createDailyActivityPage(): void {
  document.body.innerHTML = `
    <button aria-label="Add Record">Add</button>
    <div role="grid">
      <table data-qa="tableGrid">
        <thead><tr><th data-qa="DLY_ACTV_CD">Daily Activity</th></tr></thead>
        <tbody>
          <tr aria-label="Record 1">
            <td><input data-qa="grid.rows.1.DLY_ACTV_CD" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("createDailyActivityRowFocusController", () => {
  it("scrolls to and focuses the editor in the new row", () => {
    createDailyActivityPage();
    const controller = createDailyActivityRowFocusController();
    const existingInput = document.querySelector<HTMLInputElement>(
      'input[data-qa$=".DLY_ACTV_CD"]',
    )!;
    const existingFocus = vi.spyOn(existingInput, "focus");

    document
      .querySelector<HTMLButtonElement>('button[aria-label="Add Record"]')!
      .click();
    controller.sync();

    const newRow = document.createElement("tr");
    const newInput = document.createElement("input");
    const newCell = document.createElement("td");
    newInput.setAttribute("data-qa", "grid.rows.2.DLY_ACTV_CD");
    newCell.append(newInput);
    newRow.append(newCell);
    const scrollIntoView = vi.fn();
    newRow.scrollIntoView = scrollIntoView;
    document.querySelector("tbody")!.append(newRow);
    const focus = vi.spyOn(newInput, "focus");

    controller.sync();

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(existingFocus).not.toHaveBeenCalled();
    controller.dispose();
  });

  it("does not refocus an existing editor after unrelated updates", () => {
    createDailyActivityPage();
    const controller = createDailyActivityRowFocusController();
    const input = document.querySelector<HTMLInputElement>(
      'input[data-qa$=".DLY_ACTV_CD"]',
    )!;
    const focus = vi.spyOn(input, "focus");

    document
      .querySelector<HTMLButtonElement>('button[aria-label="Add Record"]')!
      .click();
    document.querySelector("tbody")!.setAttribute("data-refreshed", "true");
    controller.sync();

    expect(focus).not.toHaveBeenCalled();
    controller.dispose();
  });
});