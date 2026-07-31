import { DAILY_ACTIVITY_QA } from "../shared/constants";
import {
  getAutocompleteSuggestions,
  type AutocompleteLookupEntry,
} from "./autocomplete";
import { getRowCell } from "./grid-alignment";
import {
  getColumnHeaders,
  getColumnIndex,
  isEnhanceableGrid,
} from "./grid-dom";
import { getPrimaryAndSummaryBodyRows, isSummaryRow } from "./column-layout";

const STYLES_ID = "adv-autocomplete-styles";
const BOUND_ATTR = "data-adv-autocomplete-bound";

interface ActiveState {
  input: HTMLInputElement | HTMLTextAreaElement;
  menu: HTMLDivElement;
  suggestions: AutocompleteLookupEntry[];
  highlightedIndex: number;
  reposition: () => void;
  cleanup: () => void;
}

export interface AutocompleteController {
  bind: (
    grid: HTMLElement,
    headerRow: HTMLElement,
    entries: AutocompleteLookupEntry[],
  ) => void;
  closeIfStale: () => void;
  ensureStyles: () => void;
}

export function createAutocompleteController(
  root: Document = document,
  onSelect: () => void = () => {},
): AutocompleteController {
  let active: ActiveState | null = null;
  let currentEntries: AutocompleteLookupEntry[] = [];

  const close = (targetInput?: HTMLInputElement | HTMLTextAreaElement) => {
    if (!active || (targetInput && active.input !== targetInput)) return;
    active.cleanup();
    active.menu.remove();
    active = null;
  };

  const render = (state: ActiveState) => {
    state.menu.replaceChildren();
    state.suggestions.forEach((entry, index) => {
      const option = root.createElement("button");
      option.type = "button";
      option.className = "adv-autocomplete-option";
      option.dataset.advSuggestionIndex = String(index);
      option.setAttribute("role", "option");
      option.setAttribute(
        "aria-selected",
        index === state.highlightedIndex ? "true" : "false",
      );
      option.classList.toggle("is-active", index === state.highlightedIndex);

      const code = root.createElement("span");
      code.className = "adv-autocomplete-code";
      code.textContent = entry.taskCode;
      const description = root.createElement("span");
      description.className = "adv-autocomplete-description";
      description.textContent = entry.description || "No description available";
      option.append(code, description);
      state.menu.appendChild(option);
    });
  };

  const position = (
    input: HTMLInputElement | HTMLTextAreaElement,
    menu: HTMLDivElement,
  ) => {
    if (!root.contains(input)) {
      close();
      return;
    }
    const rect = input.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      close();
      return;
    }
    const view = root.defaultView;
    if (!view) return;
    const maxWidth = Math.min(420, view.innerWidth - 16);
    const width = Math.min(Math.max(rect.width, 280), maxWidth);
    menu.style.width = `${width}px`;
    menu.style.left = `${Math.min(rect.left, view.innerWidth - width - 8)}px`;
    const top = rect.bottom + 4;
    const menuHeight = menu.offsetHeight || 0;
    menu.style.top = `${
      top + menuHeight > view.innerHeight - 8
        ? Math.max(8, rect.top - menuHeight - 4)
        : top
    }px`;
  };

  const select = (
    input: HTMLInputElement | HTMLTextAreaElement,
    suggestionIndex: number,
    keepFocus: boolean,
  ) => {
    if (!active || active.input !== input) return;
    const selectedEntry = active.suggestions[suggestionIndex];
    if (!selectedEntry) return;

    setFormControlValue(input, selectedEntry.taskCode);
    close();
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    if (keepFocus) {
      input.focus();
      input.setSelectionRange?.(
        selectedEntry.taskCode.length,
        selectedEntry.taskCode.length,
      );
    }
    close(input);
    root.defaultView?.requestAnimationFrame(onSelect);
  };

  const ensureState = (
    input: HTMLInputElement | HTMLTextAreaElement,
  ): ActiveState => {
    if (active?.input === input) return active;
    close();
    const menu = root.createElement("div");
    menu.className = "adv-autocomplete-menu";
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", "Daily Activity suggestions");
    menu.addEventListener("pointerdown", (event) => {
      const option = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        "[data-adv-suggestion-index]",
      );
      if (!option) return;
      event.preventDefault();
      const optionIndex = Number(option.dataset.advSuggestionIndex);
      if (Number.isInteger(optionIndex)) select(input, optionIndex, true);
    });
    root.body.appendChild(menu);
    const reposition = () => position(input, menu);
    const view = root.defaultView;
    const cleanup = () => {
      view?.removeEventListener("resize", reposition);
      view?.removeEventListener("scroll", reposition, true);
    };
    view?.addEventListener("resize", reposition);
    view?.addEventListener("scroll", reposition, true);
    active = {
      input,
      menu,
      suggestions: [],
      highlightedIndex: 0,
      reposition,
      cleanup,
    };
    return active;
  };

  const update = (
    input: HTMLInputElement | HTMLTextAreaElement,
    query: string,
  ) => {
    if (!root.contains(input)) {
      close();
      return;
    }
    const trimmedQuery = query.trim();
    const suggestions = trimmedQuery
      ? getAutocompleteSuggestions(currentEntries, trimmedQuery)
      : [];
    if (suggestions.length === 0) {
      close(input);
      return;
    }
    const state = ensureState(input);
    state.suggestions = suggestions;
    state.highlightedIndex = Math.min(
      state.highlightedIndex,
      suggestions.length - 1,
    );
    render(state);
    state.reposition();
  };

  const moveHighlight = (delta: number) => {
    if (!active || active.suggestions.length === 0) return;
    active.highlightedIndex =
      (active.highlightedIndex + delta + active.suggestions.length) %
      active.suggestions.length;
    render(active);
    active.menu
      .querySelector<HTMLElement>(
        `[data-adv-suggestion-index="${active.highlightedIndex}"]`,
      )
      ?.scrollIntoView({ block: "nearest" });
  };

  const bindInput = (input: HTMLInputElement | HTMLTextAreaElement) => {
    input.setAttribute(BOUND_ATTR, "true");
    input.setAttribute("autocomplete", "off");
    input.addEventListener("focus", () => update(input, input.value));
    input.addEventListener("input", () => update(input, input.value));
    input.addEventListener("keydown", (rawEvent) => {
      const event = rawEvent as KeyboardEvent;
      const state = active;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (!state || state.input !== input) update(input, input.value);
        if (active?.input === input && active.suggestions.length > 0) {
          event.preventDefault();
          event.stopPropagation();
          moveHighlight(event.key === "ArrowDown" ? 1 : -1);
        }
      } else if (event.key === "Escape" && state?.input === input) {
        event.preventDefault();
        close();
      } else if (
        (event.key === "Enter" || event.key === "Tab") &&
        state?.input === input &&
        state.suggestions.length > 0
      ) {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
        }
        select(input, state.highlightedIndex, event.key !== "Tab");
      }
    });
    input.addEventListener("blur", () => {
      root.defaultView?.setTimeout(() => {
        if (active?.input === input) close();
      }, 150);
    });
  };

  return {
    bind(grid, headerRow, entries) {
      currentEntries = entries;
      if (entries.length === 0) return;
      const activityHeader = headerRow.querySelector<HTMLElement>(
        `th[data-qa="${DAILY_ACTIVITY_QA}"]`,
      );
      if (!activityHeader) return;
      const columnIndex = getColumnIndex(activityHeader);
      const headerColumnCount = getColumnHeaders(headerRow).length;
      getPrimaryAndSummaryBodyRows(grid, headerColumnCount).forEach((row) => {
        if (isSummaryRow(row)) return;
        const input = getRowCell(row, columnIndex)?.querySelector<
          HTMLInputElement | HTMLTextAreaElement
        >('input:not([type="checkbox"]):not([type="hidden"]), textarea');
        if (input && input.getAttribute(BOUND_ATTR) !== "true")
          bindInput(input);
      });
    },
    closeIfStale() {
      if (
        active &&
        (!root.contains(active.input) || !isEnhanceableGrid(active.input))
      ) {
        close();
      }
    },
    ensureStyles() {
      if (root.getElementById(STYLES_ID)) return;
      const style = root.createElement("style");
      style.id = STYLES_ID;
      style.textContent = AUTOCOMPLETE_STYLES;
      root.head.appendChild(style);
    },
  };
}

function setFormControlValue(
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const prototype =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (valueSetter) valueSetter.call(input, value);
  else input.value = value;
}

const AUTOCOMPLETE_STYLES = `
  .adv-autocomplete-menu {
    position: fixed;
    z-index: 9999;
    max-height: 320px;
    overflow-y: auto;
    padding: 6px;
    border: 1px solid rgba(15, 23, 42, 0.16);
    border-radius: 10px;
    background: #ffffff;
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
  }

  .adv-autocomplete-option {
    display: flex;
    width: 100%;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #0f172a;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .adv-autocomplete-option:hover,
  .adv-autocomplete-option.is-active { background: #e0f2fe; }
  .adv-autocomplete-code { flex: 0 0 auto; font-weight: 700; white-space: nowrap; }
  .adv-autocomplete-description { flex: 1 1 auto; color: #475569; line-height: 1.35; }
  td.adv-description {
    color: color-mix(in srgb, currentColor 60%, transparent);
    font-style: italic;
  }
`;
