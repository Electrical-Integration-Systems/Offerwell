import type { Document } from "@xmldom/xmldom";
import { flowError } from "./errors";

// Exact font colors from the reference workbook screenshot.
export const OUTPUT_COLUMN_COLORS = ["FFFF0000", "FFFF0000", "FF00B050", "FF00B050", "FF000000", "FF000000"] as const;

export function appendOutputStyles(document: Document) {
  const root = document.documentElement!;
  const create = (name: string) => document.createElementNS(root.namespaceURI, root.prefix ? `${root.prefix}:${name}` : name);
  const fonts = document.getElementsByTagNameNS("*", "fonts")[0];
  const formats = document.getElementsByTagNameNS("*", "cellXfs")[0];
  const fills = document.getElementsByTagNameNS("*", "fills")[0];
  const borders = document.getElementsByTagNameNS("*", "borders")[0];
  if (!fonts || !formats || !fills || !borders) throw flowError("INVALID_FILE", "Fișierul Excel nu conține stilurile de bază. Salvează-l din nou ca .xlsx și reîncarcă-l.");
  // Index zero can contain a custom fill or border in an input workbook.
  // Use explicit empty definitions instead of inheriting its base style.
  const fillId = fills.getElementsByTagNameNS("*", "fill").length;
  const emptyFill = create("fill");
  const pattern = create("patternFill"); pattern.setAttribute("patternType", "none");
  emptyFill.appendChild(pattern); fills.appendChild(emptyFill);
  fills.setAttribute("count", String(fillId + 1));
  const borderId = borders.getElementsByTagNameNS("*", "border").length;
  const emptyBorder = create("border");
  for (const edge of ["left", "right", "top", "bottom", "diagonal"]) emptyBorder.appendChild(create(edge));
  borders.appendChild(emptyBorder);
  borders.setAttribute("count", String(borderId + 1));
  const fontIds = new Map<string, number>();
  const styles = OUTPUT_COLUMN_COLORS.map((color) => {
    let fontId = fontIds.get(color);
    if (fontId === undefined) {
      fontId = fonts.getElementsByTagNameNS("*", "font").length;
      const font = create("font");
      const name = create("name"); name.setAttribute("val", "Arial");
      const size = create("sz"); size.setAttribute("val", "10");
      const foreground = create("color"); foreground.setAttribute("rgb", color);
      font.appendChild(create("b")); font.appendChild(size); font.appendChild(foreground); font.appendChild(name);
      fonts.appendChild(font);
      fontIds.set(color, fontId);
    }
    const style = (header: boolean) => {
      const index = formats.getElementsByTagNameNS("*", "xf").length;
      const format = create("xf");
      for (const [key, value] of Object.entries({ numFmtId: header ? "0" : "4", fontId: String(fontId), fillId: String(fillId), borderId: String(borderId), xfId: "0", applyFont: "1", applyNumberFormat: "1", applyAlignment: "1", applyFill: "1", applyBorder: "1" })) format.setAttribute(key, value);
      const alignment = create("alignment");
      alignment.setAttribute("horizontal", header ? "center" : "right");
      alignment.setAttribute("vertical", "center");
      if (header) alignment.setAttribute("wrapText", "1");
      format.appendChild(alignment);
      formats.appendChild(format);
      return String(index);
    };
    return { header: style(true), value: style(false) };
  });
  fonts.setAttribute("count", String(fonts.getElementsByTagNameNS("*", "font").length));
  formats.setAttribute("count", String(formats.getElementsByTagNameNS("*", "xf").length));
  return styles;
}
