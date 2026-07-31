import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAutocompleteEntries } from "./autocomplete";
import { createAutocompleteController } from "./autocomplete-dom";

const entries = buildAutocompleteEntries([
  { taskCode: "PRJ-1", description: "Monitor", searchText: "PRJ-1 Monitor" },
  {
    taskCode: "PRJ-2",
    description: "Replace monitor",
    searchText: "PRJ-2 Replace monitor",
  },
]);

function createGrid(): {
  grid: HTMLTableElement;
  headerRow: HTMLTableRowElement;
  input: HTMLInputElement;
} {
  document.body.innerHTML = `
    <table data-qa="tableGrid">
      <thead><tr><th data-qa="DLY_ACTV_CD">Daily Activity</th></tr></thead>
      <tbody><tr><td><input value="prj"></td></tr></tbody>
    </table>
  `;
  const grid = document.querySelector<HTMLTableElement>("table")!;
  const input = grid.querySelector<HTMLInputElement>("input")!;
  vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
    width: 160,
    height: 30,
    left: 20,
    right: 180,
    top: 20,
    bottom: 50,
  } as DOMRect);
  return { grid, headerRow: grid.querySelector("thead tr")!, input };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("createAutocompleteController", () => {
  it("binds an activity input once and renders matching suggestions", () => {
    const { grid, headerRow, input } = createGrid();
    const controller = createAutocompleteController();

    controller.bind(grid, headerRow, entries);
    controller.bind(grid, headerRow, entries);
    input.dispatchEvent(new Event("focus"));

    expect(input.getAttribute("autocomplete")).toBe("off");
    expect(document.querySelectorAll(".adv-autocomplete-option")).toHaveLength(
      2,
    );
  });

  it("selects the active suggestion and emits input and change events", () => {
    const { grid, headerRow, input } = createGrid();
    const onSelect = vi.fn();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const inputEvent = vi.fn();
    const changeEvent = vi.fn();
    input.addEventListener("input", inputEvent);
    input.addEventListener("change", changeEvent);
    const controller = createAutocompleteController(document, onSelect);
    controller.bind(grid, headerRow, entries);
    input.dispatchEvent(new Event("focus"));

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    expect(input.value).toBe("PRJ-1");
    expect(inputEvent).toHaveBeenCalledOnce();
    expect(changeEvent).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledOnce();
    expect(document.querySelector(".adv-autocomplete-menu")).toBeNull();
  });

  it("closes the menu after blur and when the input enters modal context", async () => {
    vi.useFakeTimers();
    const { grid, headerRow, input } = createGrid();
    const controller = createAutocompleteController();
    controller.bind(grid, headerRow, entries);
    input.dispatchEvent(new Event("focus"));

    input.dispatchEvent(new Event("blur"));
    await vi.advanceTimersByTimeAsync(150);
    expect(document.querySelector(".adv-autocomplete-menu")).toBeNull();

    input.dispatchEvent(new Event("focus"));
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    grid.replaceWith(dialog);
    dialog.appendChild(grid);
    controller.closeIfStale();
    expect(document.querySelector(".adv-autocomplete-menu")).toBeNull();
  });
});
