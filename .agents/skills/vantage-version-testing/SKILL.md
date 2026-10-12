---
name: vantage-version-testing
description: "Use when testing a new Vantage release, QA build, or regression against the ad-vantage Chrome extension; covers live DOM checks, explicit feature tests, pagination setup, and safe cleanup."
---

# Vantage Version Testing

Use this workflow to test a new Vantage version against the installed ad-vantage extension through the configured Chrome DevTools MCP connection. Treat the live application as stateful: use a sandbox for tests that add, edit, delete, or refresh timesheet records.

## Preconditions

1. Read the current feature list in `README.md`, this test matrix, and `.github/copilot-instructions.md`. Check the extension manifest for supported Vantage hosts and inspect nearby feature code when a test's expected behavior is unclear.
2. Use the existing Chrome DevTools session at `http://127.0.0.1:9223` when available. Identify the Vantage tab and record its URL, title, application/build version, selected tab, record count, page size, visible console errors, and relevant network status before interacting.
3. Treat the user's invocation of this skill as confirmation that the active Vantage page is a full sandbox and authorization to create, edit, delete, save, submit, and refresh test data as required by the test matrix; no separate confirmation is required. If the user explicitly says otherwise, perform read-only checks only. Use only test-created data for mutations and never alter pre-existing employee records.
4. Do not reload or navigate away from the authenticated Vantage tab unless necessary and authorized; reloads can end the user's session. Do not change text by assigning to Vantage-owned `textContent` or `innerHTML`.
5. Prefer a fresh accessibility snapshot before using element UIDs. Re-read state after asynchronous tab switches, pagination, and dialogs. Record pre-existing console messages separately from messages that appear after test interactions.

## Explicit Test Matrix

Run each applicable test and report its status with observed evidence. Use these markers consistently: **✅ Pass**, **❌ Fail**, and **⚠️ Not testable**.

### 1. Host Activation and Scope

- On a supported host (including a configured QA host), verify the content script loads and the page remains usable. Check the manifest's `matches` list rather than assuming a QA hostname is supported.
- Verify the Daily Activity enhancements do not appear on unrelated pages or on the Time Entry and Summary tabs.
- On `Timesheet (TIMEI)` with Daily Activity active, verify the Description column, Daily Activity autocomplete, time warnings, and Update Timesheet shortcut appear only when their owning UI is present.

### 2. Grid Layout and Preferences

- Confirm hidden and frozen columns match saved preferences. Check the frozen columns' computed `position` and offsets.
- Horizontally scroll the grid and compare header and body-cell positions for Daily Activity, Description, Event, and representative date columns. Their horizontal positions and widths should remain aligned.
- Confirm dynamic date headers normalize to weekdays without duplicate popup entries across the 14-day period.
- Inspect the Total Hours summary row at the bottom of the grid. Its colspan cells must remain aligned under the correct date columns when columns are hidden or frozen.
- If practical, test a row add or grid resize and confirm the synthetic Description column stays aligned.

### 3. Description Lookup and Autocomplete

- Confirm known task codes render their expected descriptions in the Description column.
- In a disposable Daily Activity input, type a case-insensitive description fragment and verify a listbox appears with matching task codes and descriptions in the expected ranking order.
- Test ArrowDown/ArrowUp highlighting and Enter selection; test Tab selection when safe. Verify the selected code is written, the Description updates, the menu closes, and input focus is retained.
- Test Escape and a query with no results; both should leave no stale menu. Restore the original value and verify it is unchanged. Do not save the test value.

### 4. Add-Row Focus and Keyboard Command

- Click the native Add Record control once. Verify the record count increases by one, the new row is brought into view, and its Daily Activity input receives focus.
- Test the configured `add-daily-activity-row` shortcut on macOS (`Command+Shift+.`) or its platform equivalent. Verify exactly one row is added and focused.
- A page-level DevTools key injection may not trigger Chrome's browser-level `chrome.commands` event. If the shortcut does not fire through that channel, mark this test **not testable**, inspect `chrome://extensions/shortcuts` manually if available, and do not report it as an extension failure.

### 5. Time-Entry Warnings

- With disposable data, verify an invalid minute value such as `01:20` receives the quarter-hour warning and a valid value such as `01:15` does not.
- Verify an empty Event cell is warned only when its row contains entered hours. Correcting the value and blurring the input should clear the warning.
- Confirm summary rows and non-time grids are not marked.
- Restore or delete only the test data created for this check.

### 6. Update Timesheet Shortcut

- On an editable `Timesheet (TIMEI)` Daily Activity view, verify exactly one injected Update Timesheet button is adjacent to the native page-level action menu.
- Click it to exercise the full native Update Timesheet action in the sandbox, even if it triggers a server-side refresh or update. Verify it routes to the native menu action, reports busy/disabled state while running, re-enables afterward, and check the refreshed page, console, and request status.
- Confirm the button is removed or absent on Time Entry, Summary, non-TIMEI pages, or when the native editable action is unavailable.

### 7. Pagination Automation

Use the native Add Record action to create test rows; never fabricate rows by inserting or rewriting Vantage DOM. Wait for the displayed record count to increase after each add. The skill invocation authorizes using native pagination and update controls to establish the required test state.

- **50-row option:** The threshold is 21 records. If fewer than 21 exist, add blank test rows to reach 21 (from 3 records, add 18). Verify 50 is enabled and 100 is unavailable. If the current page size is already 50, use the native pagination control to select 20, then verify the extension automatically returns to 50.
- **100-row option:** Create at least 101 records, adding only blank test rows as needed. Verify 100 becomes enabled. If the current size is not 20, use the native pagination control to select 20 and verify the extension automatically selects 100. If adding a row resets the page size to 20, verify that path as well.
- Check `aria-disabled` as well as the DOM `disabled` property; Vantage may communicate unavailable page sizes only through `aria-disabled="true"`. Determine the current choice from `aria-current` or `aria-pressed`.
- Verify repeated mutation noise does not cause repeated clicks when the eligible state has not changed. If the native control cannot expose or select the 20-row fallback, report the affected transition as **not testable**.
- Before cleanup, verify stable identifiers still distinguish every test-created row after pagination and re-rendering. Never bulk-delete using only displayed row positions or row/line labels that may be reassigned. If identity is ambiguous, stop cleanup rather than guess and report the remaining test rows and current state.
- Delete only the temporary rows added for this test when cleanup is appropriate. Confirm the original records remain and report the final page size and record count.

### 8. Other Tabs and Regression Checks

- Switch to Time Entry and Summary, wait for each asynchronous transition, and confirm Daily Activity-only extension UI is absent. Return to Daily Activity afterward.
- Check the page for overlapping controls, broken grid alignment, stuck busy states, dialogs, and loss of the authenticated session.
- Compare console errors and warnings to the baseline. Identify whether their stacks point to ad-vantage or Vantage; do not attribute an application error to the extension without evidence.
- Inspect network status only as needed. Report failed requests by status and endpoint, without exposing request payloads or personal timesheet data.

## Test Data and Cleanup

- Keep test rows blank unless a specific test requires values. Use distinct, tracked test rows and never edit existing employee entries to create a scenario.
- Before deletion, verify the selected rows are exactly the test rows created during this run using stable record identifiers. Treat row index, `aria-label`, and line number as unstable after pagination or refresh. Never use Select All as cleanup.
- Clean up test rows when the goal is a transient verification. Leave them in place only when the user asks for a persistent test fixture or needs the grid ready for further testing; state the resulting record count clearly.
- Do not remove or alter pre-existing records, even in a sandbox, unless the user explicitly asks. Saving or submitting is allowed only for test-created data when a test case requires it.

## Report

Present each applicable test-matrix case in a compact table or scannable list, prefixed with its status marker and followed by concise observed evidence. Summarize the Vantage host/build, concrete regressions, console/network findings, any totals or pagination discrepancies, and the final state of test data. Distinguish extension behavior from Vantage behavior and disclose any browser-level tests that DevTools could not exercise.
