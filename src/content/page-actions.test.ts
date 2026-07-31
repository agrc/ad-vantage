import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createUpdateTimesheetShortcutController,
  hasVisibleEnabledEditableTimesheetAction,
} from "./page-actions";

function createPage(markup: string): HTMLDivElement {
  const page = document.createElement("div");
  page.innerHTML = markup;
  return page;
}

function isVisible(element: HTMLElement): boolean {
  return !element.hidden;
}

function createTimesheetPage(options: { editable?: boolean } = {}): void {
  document.title = "Timesheet (TIMEI)";
  document.body.innerHTML = `
    <div class="page-actions">
      ${
        options.editable === false
          ? ""
          : '<button class="native-action" data-qa="hrm.page.viewActions.save">Save</button>'
      }
      <button data-qa-id="hrm.page.viewMenu.pageLevelThreedotMenu">Actions</button>
    </div>
    <div role="grid">
      <table data-qa="tableGrid">
        <thead><tr><th data-qa="DLY_ACTV_CD">Daily Activity</th></tr></thead>
      </table>
    </div>
  `;
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
    length: 1,
  } as DOMRectList);
}

function getShortcut(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(
    'button[data-adv-update-timesheet-shortcut="true"]',
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  document.title = "";
});

describe("hasVisibleEnabledEditableTimesheetAction", () => {
  it("recognizes a visible, enabled native save action", () => {
    const page = createPage(
      '<button data-qa="hrm.page.viewActions.save">Save</button>',
    );

    expect(hasVisibleEnabledEditableTimesheetAction(page, isVisible)).toBe(
      true,
    );
  });

  it("rejects read-only page actions", () => {
    const page = createPage(
      '<button data-qa-id="hrm.page.viewMenu.pageLevelThreedotMenu">Actions</button>',
    );

    expect(hasVisibleEnabledEditableTimesheetAction(page, isVisible)).toBe(
      false,
    );
  });

  it("rejects hidden or disabled native save actions", () => {
    const hiddenPage = createPage(
      '<button hidden data-qa="hrm.page.viewActions.save">Save</button>',
    );
    const disabledPage = createPage(
      '<button disabled data-qa="hrm.page.viewActions.saveAndClose">Save &amp; Close</button>',
    );

    expect(
      hasVisibleEnabledEditableTimesheetAction(hiddenPage, isVisible),
    ).toBe(false);
    expect(
      hasVisibleEnabledEditableTimesheetAction(disabledPage, isVisible),
    ).toBe(false);
  });
});

describe("createUpdateTimesheetShortcutController", () => {
  it("adds one shortcut beside the native menu and removes duplicates", () => {
    createTimesheetPage();
    const menuTrigger = document.querySelector<HTMLButtonElement>(
      'button[data-qa-id$=".viewMenu.pageLevelThreedotMenu"]',
    )!;
    menuTrigger.insertAdjacentHTML(
      "beforebegin",
      '<button data-adv-update-timesheet-shortcut="true">Old</button><button data-adv-update-timesheet-shortcut="true">Duplicate</button>',
    );

    createUpdateTimesheetShortcutController().sync();

    const shortcuts = document.querySelectorAll(
      'button[data-adv-update-timesheet-shortcut="true"]',
    );
    expect(shortcuts).toHaveLength(1);
    expect(shortcuts[0].nextElementSibling).toBe(menuTrigger);
  });

  it("removes the shortcut when the page becomes read-only", () => {
    createTimesheetPage();
    const controller = createUpdateTimesheetShortcutController();
    controller.sync();
    expect(getShortcut()).not.toBeNull();

    document.querySelector('[data-qa$=".viewActions.save"]')?.remove();
    controller.sync();

    expect(getShortcut()).toBeNull();
  });

  it("disables the shortcut when a stale native menu action is disabled", () => {
    createTimesheetPage();
    document.body.insertAdjacentHTML(
      "beforeend",
      '<button role="menuitem" aria-disabled="true">Update Timesheet</button>',
    );

    createUpdateTimesheetShortcutController().sync();

    expect(getShortcut()?.disabled).toBe(true);
  });

  it("forwards clicks to an existing enabled native menu action", async () => {
    vi.useFakeTimers();
    createTimesheetPage();
    const nativeAction = document.createElement("button");
    nativeAction.setAttribute("role", "menuitem");
    nativeAction.textContent = "Update Timesheet";
    document.body.append(nativeAction);
    const nativeClick = vi.fn();
    nativeAction.addEventListener("click", nativeClick);
    createUpdateTimesheetShortcutController().sync();

    getShortcut()?.click();
    await vi.runAllTimersAsync();

    expect(nativeClick).toHaveBeenCalledOnce();
    expect(getShortcut()?.getAttribute("aria-busy")).toBeNull();
  });

  it("opens the native menu and clicks an action rendered afterward", async () => {
    vi.useFakeTimers();
    createTimesheetPage();
    const menuTrigger = document.querySelector<HTMLButtonElement>(
      'button[data-qa-id$=".viewMenu.pageLevelThreedotMenu"]',
    )!;
    const nativeClick = vi.fn();
    menuTrigger.addEventListener("click", () => {
      const nativeAction = document.createElement("button");
      nativeAction.setAttribute("role", "menuitem");
      nativeAction.textContent = "Update Timesheet";
      nativeAction.addEventListener("click", nativeClick);
      document.body.append(nativeAction);
    });
    createUpdateTimesheetShortcutController().sync();

    getShortcut()?.click();
    await vi.runAllTimersAsync();

    expect(nativeClick).toHaveBeenCalledOnce();
  });

  it("coalesces scheduled sync work into one animation frame", () => {
    createTimesheetPage();
    const callbacks: FrameRequestCallback[] = [];
    const requestFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callbacks.push(callback);
        return callbacks.length;
      });
    const controller = createUpdateTimesheetShortcutController();

    controller.schedule();
    controller.schedule();

    expect(requestFrame).toHaveBeenCalledOnce();
    callbacks[0](0);
    expect(getShortcut()).not.toBeNull();
  });
});
