import { assert } from '../middleware/http.mjs';
export function parseCsv(text) {
  assert(typeof text === 'string' && text.length <= 80000, 'CSV must be under 80 KB');
  const rows = [];
  let row = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  assert(!quoted, 'CSV has an unclosed quoted field');
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  assert(rows.length >= 2 && rows.length <= 201, 'CSV must contain a header and 1–200 member rows');
  const headers = rows.shift().map(x => x.replace(/^\uFEFF/, '').trim());
  assert(new Set(headers).size === headers.length, 'CSV has duplicate headers');
  return rows.map((r, i) => {
    assert(r.length === headers.length, `CSV row ${i + 2} has the wrong number of cells`);
    return Object.fromEntries(headers.map((h, j) => [h, r[j].trim()]));
  });
}
