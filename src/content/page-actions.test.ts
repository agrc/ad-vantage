import { describe, expect, it } from "vitest";
import { hasVisibleEnabledEditableTimesheetAction } from "./page-actions";

function createPage(markup: string): HTMLDivElement {
  const page = document.createElement("div");
  page.innerHTML = markup;
  return page;
}

function isVisible(element: HTMLElement): boolean {
  return !element.hidden;
}

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
