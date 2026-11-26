/** Restore reading order by aligning OCR boxes on the same printed baseline. */
export function groupReceiptRows(items) {
  const boxes = [];
  for (const item of items) {
    const text = item.text.trim();
    if (!text) continue;
    const points = item.poly;
    if (!points?.length) continue;
    const xs = points.map(point => point[0]);
    const ys = points.map(point => point[1]);
    if (![...xs, ...ys].every(Number.isFinite)) continue;
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    if (bottom <= top) continue;
    boxes.push({ text, x: Math.min(...xs), y: (top + bottom) / 2, height: bottom - top });
  }
  boxes.sort((a, b) => a.y - b.y || a.x - b.x);

  const rows = [];
  for (const box of boxes) {
    const row = rows.at(-1);
    if (row && Math.abs(box.y - row.anchor.y) <= 0.55 * Math.min(row.anchor.height, box.height)) {
      row.boxes.push(box);
    } else {
      rows.push({ anchor: box, boxes: [box] });
    }
  }
  return rows.length
    ? rows.map(row => row.boxes.sort((a, b) => a.x - b.x).map(box => box.text).join(" "))
    : items.map(item => item.text.trim()).filter(Boolean);
}
