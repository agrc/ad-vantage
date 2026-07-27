export const EDITABLE_TIMESHEET_ACTION_SELECTOR = [
  'button[data-qa$=".viewActions.saveAndClose"]',
  'button[data-qa$=".viewActions.save"]',
].join(", ");

export function hasVisibleEnabledEditableTimesheetAction(
  root: ParentNode,
  isVisible: (element: HTMLElement) => boolean,
): boolean {
  return Array.from(
    root.querySelectorAll<HTMLButtonElement>(
      EDITABLE_TIMESHEET_ACTION_SELECTOR,
    ),
  ).some(
    (button) =>
      isVisible(button) &&
      !button.disabled &&
      button.getAttribute("aria-disabled") !== "true",
  );
}
