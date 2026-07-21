export function getCellColumnSpan(cell: HTMLElement): number {
  return cell instanceof HTMLTableCellElement && cell.colSpan > 0
    ? cell.colSpan
    : 1;
}

export function getRowCell(
  row: HTMLElement,
  columnIndex: number,
): HTMLElement | undefined {
  if (columnIndex < 1) {
    return undefined;
  }

  let currentColumn = 1;

  for (const child of Array.from(row.children)) {
    if (!(child instanceof HTMLElement)) continue;

    const span = getCellColumnSpan(child);

    if (columnIndex >= currentColumn && columnIndex < currentColumn + span) {
      return child;
    }

    currentColumn += span;
  }

  return undefined;
}

export function applyColumnWidth(
  cell: HTMLElement,
  width: number,
  preserveNativeWidth = false,
): boolean {
  if (
    width <= 0 ||
    !(cell instanceof HTMLTableCellElement) ||
    cell.colSpan !== 1
  ) {
    return false;
  }

  if (preserveNativeWidth) {
    cell.style.removeProperty("width");
    cell.style.removeProperty("min-width");
    cell.style.removeProperty("max-width");
    return true;
  }

  const widthValue = `${width}px`;
  cell.style.setProperty("width", widthValue, "important");
  cell.style.setProperty("min-width", "0", "important");
  cell.style.setProperty("max-width", widthValue, "important");
  return true;
}
