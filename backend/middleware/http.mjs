export class ApiError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function assert(condition, message, status = 400) { if (!condition) throw new ApiError(message, status); }
export function str(v, min = 1, max = 120) { return typeof v === 'string' && v.trim().length >= min && v.length <= max; }
export function money(v) { return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100000000; }
export function date(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v; }
export function json(res, status, body) { res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(body)); }
export async function parseBody(req) {
  let data = '';
  for await (const chunk of req) { data += chunk; assert(data.length < 100000, 'Request too large', 413); }
  try { return JSON.parse(data || '{}'); } catch { throw new ApiError('Invalid JSON'); }
}
