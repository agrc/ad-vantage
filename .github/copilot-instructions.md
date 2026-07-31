# Ad-vantage Project Instructions

This file contains important context and learned constraints when building the Ad-vantage Chrome extension for the Vantage timesheet app.

## Browser Debugging Workflow

When working on Vantage UI behavior, prefer inspecting the live page through the configured Chrome DevTools MCP connection if it is available instead of relying only on static DOM references or code inspection.

- The project uses Google Chrome Dev for browser inspection and extension debugging.
- The Chrome Dev remote debugging endpoint is `http://127.0.0.1:9223`.
- Use the live Vantage page in Chrome Dev via the Chrome DevTools MCP connection when investigating selectors, layout behavior, injected extension UI, or runtime DOM issues.

## Extension Reload Constraint

Local extension rebuilds or reloads can force the Vantage page to refresh, which drops the current session and sends the user back through the login flow.

- Batch related edits together whenever possible instead of making many tiny incremental changes.
- Prefer live DOM inspection, targeted reads, and validation before editing so code changes are more deliberate.
- Avoid unnecessary rebuilds or reload-triggering changes while debugging the live page.
- When a rebuild is necessary, assume the user may need to log back into Vantage before the page can be rechecked.

## DOM Reference File

Use [docs/vantage-timesheet-grid-reference.html](docs/vantage-timesheet-grid-reference.html) as the simplified structural reference for the Vantage timesheet grid when working on selectors, column handling, row parsing, attachments, totals, or editable versus read-only cells.

- This file is intentionally simplified. It keeps the important table shape and representative control types while omitting framework noise, duplicate hidden headers, CSS classes, and telemetry attributes.

## Content Module Ownership

Keep `src/content/index.ts` focused on loading state and orchestrating feature modules. Put feature behavior in the module that owns it:

- `grid-dom.ts`: grid discovery, headers, column keys, and weekday normalization.
- `grid-alignment.ts`: logical cell lookup across colspans and width application.
- `column-layout.ts`: visibility, frozen columns, summary rows, and expanded-detail exclusions.
- `description-column.ts`: synthetic Description headers/cells and sticky-header widths.
- `autocomplete.ts` and `autocomplete-dom.ts`: suggestion ranking and autocomplete interaction lifecycle.
- `page-actions.ts`: Update Timesheet shortcut lifecycle.
- `pagination.ts`: pagination automation.
- `time-warnings.ts` and `time-entry-validation.ts`: warning DOM behavior and pure validation decisions.

Pass current preferences and lookup data into feature modules rather than duplicating storage listeners or module-level state. Preserve summary-row colspans, sticky-header behavior, modal exclusions, and the immediate-plus-animation-frame mutation pass unless live profiling supports a timing change.

## README Maintenance

When implementing a new user-visible feature, behavior change, workflow change, or setup change, update [README.md](README.md) in the same task unless the user explicitly says not to.

- Add or revise the relevant feature bullet, usage note, setup step, limitation, or screenshot reference so the README stays aligned with the shipped extension behavior.
- When a user-visible change affects the Chrome Web Store listing, update `manifest.json` and `docs/chrome-web-store-listing.md` in the same task so its summary and description remain current.
- Do not update the README for purely internal refactors unless they change developer setup, debugging, or release behavior.

## Post-Work Verification

After finishing code changes, run the project's non-watch validation commands before reporting completion.

- Run focused tests immediately after changing a feature module.
- Run `pnpm test`.
- Run `pnpm coverage` when changing behavior or tests.
- Run `pnpm lint`.
- Run `pnpm check`.
- Run `pnpm build` for changes that affect extension runtime code or configuration.
- Run `git diff --check`.
- If any command fails, resolve the issue and rerun the affected command until it passes.

## Working with the Vantage DOM (Angular)

The Vantage timesheet application is built on Angular. Its DOM contains invisible structural elements, such as Angular component hooks and directive comment nodes, that the framework relies on for its internal view model.

- **DO NOT** use `element.textContent = ...` or `element.innerHTML = ...` to modify text inside Vantage-owned elements, especially grid headers. Doing so destroys Angular's structural nodes and can crash the app during change detection.
- **DO** use a `document.createTreeWalker()` targeting `NodeFilter.SHOW_TEXT` to find and update text nodes without interfering with sibling structural nodes.
- Extension-owned elements may use normal DOM construction and `textContent`; build page-derived content with DOM APIs rather than HTML strings.

## Handling Dynamic Date Columns

Vantage headers encompass 14-day pay periods and display dynamic dates periodically, for example `Sat 03/14`.

- Normalize date headers to weekday keys through `getColumnKey()` in `src/content/grid-dom.ts` so hidden and frozen preferences persist across pay periods.
- Deduplicate normalized keys when building popup column metadata so a pay period does not produce duplicate weekday controls.