import { MemoryRepository, handleRpc, normalizeScope } from './rpc.js';

const ENDPOINT = 'dsh_memory';
const permissive = { safeParse(value) { return { success: true, data: value }; }, parse(value) { return value; } };

class LocalDomain {
  constructor() {
    this.tables = new Map();
    this.globalValue = {};
  }
  table(name) {
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    const table = this.tables.get(name);
    return { get: (key) => table.get(key), entries: () => table.entries(), values: () => table.values(), keys: () => table.keys(), get size() { return table.size; }, put: async (key, value) => table.set(key, value), delete: async (key) => table.delete(key), update: async (key, fn) => { const value = fn(table.get(key)); table.set(key, value); return value; } };
  }
  async close() {}
}

export const inject = ['connection', 'tools'];

export async function apply(ctx, config = {}) {
  const storageDomain = ctx.get?.('storageDomain');
  let domain;
  let owned = false;
  if (storageDomain) {
    domain = await storageDomain.open({
      name: 'dsh_memory',
      version: 1,
      layout: 'single',
      invalidRecords: 'backup-and-skip',
      tables: {
        memory_items: { valueSchema: permissive },
        sources: { valueSchema: permissive },
        revisions: { valueSchema: permissive },
        policy: { valueSchema: permissive },
        access_log: { valueSchema: permissive },
      },
    });
  } else {
    if (!globalThis.__DSH_MEMORY_LOCAL__) globalThis.__DSH_MEMORY_LOCAL__ = new LocalDomain();
    domain = globalThis.__DSH_MEMORY_LOCAL__;
  }
  const repository = new MemoryRepository(domain, config);
  owned = Boolean(storageDomain);

  const disposer = ctx.connection.rpc.handle(ENDPOINT, async (_endpoint, payload = {}, _signal, peer) => handleRpc(repository, payload, peer));
  ctx.effect?.(() => { Promise.resolve(disposer?.()).catch(() => {}); if (owned) Promise.resolve(domain.close()).catch(() => {}); });

  if (ctx.tools?.register) {
    const toolDisposer = ctx.tools.register({
      name: 'memory',
      description: 'Read scoped user memories and their sources. Write, delete, restore, and policy changes remain user-only in the UI; sensitive content is always rejected.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: { type: 'string', enum: ['status', 'list', 'search'] },
          id: { type: 'string' },
          query: { type: 'string' },
          content: { type: 'string' },
          source: { type: 'object' },
          includeDeleted: { type: 'boolean' },
        },
        required: ['action'],
      },
      output: { schema: { type: 'object' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
      async execute(args, exec) {
        const peer = { id: exec.agent?.id || 'agent' };
        const action = String(args?.action || 'status');
         if (!['status', 'list', 'search'].includes(action)) return { ok: false, error: { code: 'USER_ONLY', message: 'Memory writes and policy changes require an explicit user action in Settings.' } };
         return repository.dispatch(normalizeScope(undefined, peer), { ...(args || {}), action });
      },
    });
    ctx.effect?.(toolDisposer);
  }
  return repository;
}
