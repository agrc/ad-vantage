export function getCellColumnSpan(cell: HTMLElement): number {
  return cell instanceof HTMLTableCellElement && cell.colSpan > 0
    ? cell.colSpan
    : 1;
}

export type ColumnLayout = {
  index: number;
  width: number;
  left: number;
};

export function getColumnLayout(headerRow: HTMLElement): ColumnLayout[] {
  const headerLeft = headerRow.getBoundingClientRect().left;

  return Array.from(headerRow.querySelectorAll<HTMLElement>("th")).map(
    (header) => {
      const bounds = header.getBoundingClientRect();
      return {
        index: Array.from(headerRow.children).indexOf(header) + 1,
        width: bounds.width,
        left: bounds.left - headerLeft,
      };
    },
  );
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
