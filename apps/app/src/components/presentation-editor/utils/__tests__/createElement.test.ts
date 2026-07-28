import { describe, expect, it } from "vitest";
import { createElementForTool } from "../createElement";

describe("createElementForTool table", () => {
  it("creates a drawable 3 × 3 table with editable cells", () => {
    const element = createElementForTool("table", "table-1", { x: 20, y: 30 }, { x: 420, y: 260 }, 4);
    expect(element).toMatchObject({
      id: "table-1",
      type: "table",
      rows: 3,
      columns: 3,
      x: 20,
      y: 30,
      width: 400,
      height: 230,
      zIndex: 4,
    });
    if (element.type === "table") expect(element.cells).toHaveLength(9);
  });
});
