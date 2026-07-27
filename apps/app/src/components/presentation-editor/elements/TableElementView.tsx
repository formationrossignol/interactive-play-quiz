import type { TableElement } from "../types/presentation";
import { useDocStore } from "../store/useDocStore";
import { useHistoryStore } from "../store/useHistoryStore";

export function TableElementView({ slideId, element, readOnly = false }: { slideId: string; element: TableElement; readOnly?: boolean }) {
  function updateCell(index: number, value: string) {
    if (value === (element.cells[index] ?? "")) return;
    const cells = [...element.cells];
    cells[index] = value;
    useHistoryStore.getState().commit();
    useDocStore.getState().updateElement(slideId, element.id, { cells });
  }

  return (
    <table
      style={{
        width: "100%",
        height: "100%",
        tableLayout: "fixed",
        borderCollapse: "collapse",
        color: element.textColor,
        fontFamily: "inherit",
        fontSize: 16,
        background: element.cellFill,
      }}
    >
      <tbody>
        {Array.from({ length: element.rows }, (_, row) => (
          <tr key={row}>
            {Array.from({ length: element.columns }, (_, column) => {
              const index = row * element.columns + column;
              const Cell = element.headerRow && row === 0 ? "th" : "td";
              return (
                <Cell
                  key={column}
                  style={{
                    border: `${element.borderWidth}px solid ${element.borderColor}`,
                    background: element.headerRow && row === 0 ? element.headerFill : element.cellFill,
                    padding: "8px 10px",
                    textAlign: "left",
                    verticalAlign: "middle",
                    fontWeight: element.headerRow && row === 0 ? 800 : 500,
                    overflow: "hidden",
                  }}
                >
                  <div
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    onPointerDown={readOnly ? undefined : (event) => event.stopPropagation()}
                    onBlur={readOnly ? undefined : (event) => updateCell(index, event.currentTarget.textContent ?? "")}
                    style={{ minHeight: "1em", outline: "none", overflow: "hidden" }}
                  >
                    {element.cells[index] ?? ""}
                  </div>
                </Cell>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
