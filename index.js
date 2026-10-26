import { MemoryRepository, handleRpc } from './rpc.js';

const ROUTE = '/api/dsh-memory';
const permissive = { safeParse(value) { return { success: true, data: value }; }, parse(value) { return value; } };
const TABLES = ['memory_items', 'sources', 'revisions', 'policy', 'access_log'];

class LocalDomain {
  constructor() {
    this.tables = new Map();
  }
  table(name) {
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    const map = this.tables.get(name);
    return {
      get: (key) => map.get(key),
      entries: () => map.entries(),
      values: () => map.values(),
      keys: () => map.keys(),
      get size() { return map.size; },
      put: async (key, value) => { map.set(key, value); },
      delete: async (key) => map.delete(key),
      update: async (key, fn) => { const value = fn(map.get(key)); map.set(key, value); return value; },
    };
  }
  async close() {}
}

export const inject = ['connection', 'tools'];

export function apply(ctx) {
  const storageDomain = ctx.get?.('storageDomain');
  let domain;
  let owned = false;

  const ready = (async () => {
    if (!storageDomain) {
      if (!globalThis.__DSH_MEMORY_LOCAL__) globalThis.__DSH_MEMORY_LOCAL__ = new LocalDomain();
      domain = globalThis.__DSH_MEMORY_LOCAL__;
    } else {
      const spec = {
        name: 'dsh_memory',
        version: 1,
        layout: 'single',
        invalidRecords: 'backup-and-skip',
        tables: Object.fromEntries(TABLES.map((table) => [table, { valueSchema: permissive }])),
      };
      // A fast disable→enable cycle can still be releasing the previous domain:
      // wait for that close, then retry the open so we never reuse stale state.
      const previous = globalThis.__DSH_MEMORY_CLOSING__;
      if (previous) await previous.catch(() => {});
      let lastError;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          domain = await storageDomain.open(spec);
          owned = true;
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
          if (error?.code !== 'already-open' && !/already open/i.test(String(error?.message))) throw error;
          await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
        }
      }
      if (!domain) {
        const existing = storageDomain.get?.('dsh_memory');
        if (existing) { domain = existing; lastError = undefined; }
      }
      if (lastError) throw lastError;
    }
    return new MemoryRepository(domain, {});
  })();
  ready.catch(() => {});

  const registry = ctx.connection?.fetch;
  const disposeRoute = typeof registry?.register === 'function'
    ? registry.register({
      path: ROUTE,
      methods: ['POST'],
      requestBody: 'buffered',
      async fetch(request) {
        let message;
        try {
          message = await request.json();
        } catch {
          return Response.json({ type: 'server-response', rpcId: 'invalid', result: { ok: false, error: { code: 'memory/bad-request', message: 'Request is not JSON.', details: {} } } }, { status: 400 });
        }
        const rpcId = typeof message?.rpcId === 'string' ? message.rpcId : 'invalid';
        const payload = message?.payload && typeof message.payload === 'object' ? message.payload : {};
        let result;
        try {
          result = await handleRpc(await ready, payload, undefined);
        } catch (error) {
          result = { ok: false, error: { code: 'memory/failed', message: String(error?.message || error), details: {} } };
        }
        return Response.json({ type: 'server-response', rpcId, result });
      },
    })
    : () => {};

  let disposeTool;
  if (ctx.tools?.register) {
    disposeTool = ctx.tools.register({
      name: 'memory',
      description: 'Read scoped user memories and their sources. Write, delete, restore, and policy changes remain user-only in the UI; sensitive content is always rejected.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: { type: 'string', enum: ['status', 'list', 'search'] },
          query: { type: 'string' },
          includeDeleted: { type: 'boolean' },
        },
        required: ['action'],
      },
      output: { schema: { type: 'object' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
      async execute(args) {
        const repository = await ready;
        const action = String(args?.action || 'status');
        if (!['status', 'list', 'search'].includes(action)) {
          return { ok: false, error: { code: 'USER_ONLY', message: 'Memory writes and policy changes require an explicit user action in Settings.' } };
        }
        return repository.dispatch('local', { ...(args || {}), action });
      },
    });
  }

  ctx.effect(() => () => {
    try { disposeRoute?.(); } catch {}
    try { disposeTool?.(); } catch {}
    if (owned && domain) {
      globalThis.__DSH_MEMORY_CLOSING__ = Promise.resolve(domain.close()).catch(() => {});
    }
  });
}

export { MemoryRepository, handleRpc };
