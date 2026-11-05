export class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function assert(condition, message, status = 400) {
  if (!condition) throw new ApiError(message, status);
}
export function str(v, min = 1, max = 120) {
  return typeof v === 'string' && v.trim().length >= min && v.length <= max;
}
export function date(v) {
  return (
    typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !isNaN(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v
  );
}
export function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
const MAX_BODY_BYTES = 100000;
export async function parseBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    assert(size < MAX_BODY_BYTES, 'Request too large', 413);
    chunks.push(chunk);
  }
  let parsed;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new ApiError('Invalid JSON object');
  }
  assert(parsed && typeof parsed === 'object' && !Array.isArray(parsed), 'Invalid JSON object');
  return parsed;
}
