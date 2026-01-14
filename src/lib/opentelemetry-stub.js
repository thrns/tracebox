/**
 * No-op stub for @opentelemetry/api used in Edge runtime (middleware).
 * The real package uses Node APIs and cannot run in Edge.
 */

const noop = () => {}
const noopSpan = {
  spanContext: () => ({}),
  setAttribute: noop,
  setStatus: noop,
  end: noop,
  addEvent: noop,
  isRecording: () => false,
  recordException: noop,
}
const noopTracer = {
  startSpan: () => noopSpan,
  startActiveSpan: (name, opts, fn) => (fn ? fn(noopSpan) : noopSpan),
}
const noopTracerProvider = {
  getTracer: () => noopTracer,
}

const context = {
  with: (_ctx, fn) => (typeof fn === 'function' ? fn() : undefined),
  bind: (_ctx, fn) => fn,
  active: () => ({}),
}
const trace = {
  getTracer: () => noopTracer,
  getTracerProvider: () => noopTracerProvider,
  setGlobalTracerProvider: noop,
  getSpan: noop,
  getSpanContext: noop,
  setSpan: noop,
  setSpanContext: noop,
}
const noopTextMapPropagator = {
  inject: noop,
  extract: (_context) => _context,
  fields: () => [],
}
const propagation = {
  inject: noop,
  extract: (_context) => _context,
  fields: () => [],
  setGlobalPropagator: noop,
  createBaggage: () => ({ getEntry: () => undefined, setEntry: (b) => b, removeEntry: (b) => b, getAllEntries: () => [], entries: () => [][Symbol.iterator]() }),
  getBaggage: () => undefined,
  getActiveBaggage: () => undefined,
  setBaggage: (_ctx) => _ctx,
  deleteBaggage: (_ctx) => _ctx,
  _getGlobalPropagator: () => noopTextMapPropagator,
  VALID_KEY_CHAR_RANGE: '',
  VALID_KEY_REGEX: /.*/,
  VALID_TRACEPARENT_REGEX: /.*/,
}
const metrics = { getMeter: () => ({}) }
const diag = { debug: noop, error: noop, info: noop, warn: noop }

// Next.js tracer expects these
const SpanStatusCode = { OK: 1, ERROR: 2, UNSET: 0 }
const SpanKind = { INTERNAL: 0, SERVER: 1, CLIENT: 2, PRODUCER: 3, CONSUMER: 4 }
const ROOT_CONTEXT = {
  getValue: () => undefined,
  setValue: function () { return this },
}
function createContextKey() {
  return {}
}

// context.active() must return something with getValue (tracer uses context.active().getValue(key))
context.active = () => ROOT_CONTEXT

const api = {
  context,
  trace,
  propagation,
  metrics,
  diag,
  SpanStatusCode,
  SpanKind,
  ROOT_CONTEXT,
  createContextKey,
}
module.exports = api
module.exports.default = api
