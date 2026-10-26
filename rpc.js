const SENSITIVE_KEY = /(?:secret|password|passwd|token|api[_-]?key|access[_-]?key|private[_-]?key|credit\s*card|card[_-]?number|cvv|cvc|ssn|credential)/i;
const SENSITIVE_VALUE = /(?:\bsecret\b|\bpassword\b|\bpasswd\b|\btoken\b|\bcredential\b|\bcredit\s*card\b|sk-[a-z0-9_-]{16,}|bearer\s+[a-z0-9._-]{12,}|(?:\d[ -]?){13,19}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
const MAX_SCOPE = 128;

export const DEFAULT_POLICY = Object.freeze({
  enabled: true,
  autoSave: true,
  scopeMode: 'peer',
  blockedPatterns: ['secret', 'password', 'token', 'credit card', 'api key'],
});

export function containsSensitive(value, key = '') {
  if (SENSITIVE_KEY.test(String(key))) return true;
  if (typeof value === 'string') return SENSITIVE_VALUE.test(value);
  if (Array.isArray(value)) return value.some((entry) => containsSensitive(entry));
  if (value && typeof value === 'object') return Object.entries(value).some(([name, entry]) => containsSensitive(entry, name));
  return false;
}

export function normalizeScope(scope, peer) {
  const raw = scope || peer?.id || 'local';
  return String(raw).replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, MAX_SCOPE) || 'local';
}

export function normalizeItem(input, now = new Date().toISOString(), maxLength = 12000) {
  const content = typeof input?.content === 'string' ? input.content.trim() : '';
  if (!content) throw Object.assign(new Error('Memory content is required.'), { code: 'INVALID_CONTENT' });
  if (content.length > maxLength) throw Object.assign(new Error('Memory content is too long.'), { code: 'CONTENT_TOO_LONG' });
  const source = input?.source && typeof input.source === 'object' ? input.source : {};
  return {
    content,
    source: {
      kind: String(source.kind || 'manual').slice(0, 80),
      label: String(source.label || '').slice(0, 160),
      uri: String(source.uri || '').slice(0, 500),
    },
    tags: Array.isArray(input?.tags) ? input.tags.map((tag) => String(tag).slice(0, 40)).slice(0, 20) : [],
    automatic: Boolean(input?.automatic),
    updatedAt: now,
  };
}

function error(code, message, details = {}) {
  return { ok: false, error: { code, message, details } };
}

function tableValues(table) {
  if (typeof table.values === 'function') return [...table.values()];
  return [...table.entries()].map(([, value]) => value);
}

export class MemoryRepository {
  constructor(domain, config = {}) {
    this.domain = domain;
    this.maxItems = Number(config.maxItems) > 0 ? Number(config.maxItems) : 500;
    this.maxContentLength = Number(config.maxContentLength) > 0 ? Math.min(Number(config.maxContentLength), 100000) : 12000;
    this.items = domain.table('memory_items');
    this.sources = domain.table('sources');
    this.revisions = domain.table('revisions');
    this.access_log = domain.table('access_log');
    this.policyTable = domain.table('policy');
  }

  async policy(scope) {
    const saved = this.policyTable.get(scope);
    return { ...DEFAULT_POLICY, ...(saved || {}) };
  }

  async log(scope, operation, ok, details = {}) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.access_log.put(id, { id, scope, operation, ok: Boolean(ok), at: new Date().toISOString(), details });
  }

  visible(item, scope, includeDeleted = false) {
    return item && item.scope === scope && (includeDeleted || !item.deletedAt);
  }

  async status(scope) {
    const all = tableValues(this.items).filter((item) => item.scope === scope);
    const policy = await this.policy(scope);
    return { ok: true, value: { enabled: policy.enabled, autoSave: policy.autoSave, scope, total: all.filter((item) => !item.deletedAt).length, deleted: all.filter((item) => item.deletedAt).length, revisions: tableValues(this.revisions).filter((item) => item.scope === scope).length } };
  }

  async list(scope, payload = {}) {
    const includeDeleted = Boolean(payload.includeDeleted);
    const limit = Math.min(Math.max(Number(payload.limit) || 50, 1), 100);
    const values = tableValues(this.items)
      .filter((item) => this.visible(item, scope, includeDeleted))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, limit);
    return { ok: true, value: values };
  }

  async search(scope, payload = {}) {
    const query = String(payload.query || '').trim().toLowerCase();
    if (!query) return this.list(scope, payload);
    const values = tableValues(this.items).filter((item) => this.visible(item, scope, Boolean(payload.includeDeleted)) && (String(item.content || '').toLowerCase().includes(query) || JSON.stringify(item.source || {}).toLowerCase().includes(query) || (Array.isArray(item.tags) ? item.tags : []).some((tag) => String(tag).toLowerCase().includes(query))));
    return { ok: true, value: values.slice(0, Math.min(Number(payload.limit) || 100, 100)) };
  }

  async create(scope, payload = {}) {
    const policy = await this.policy(scope);
    if (!policy.enabled) return error('POLICY_DISABLED', 'Memory saving is disabled by policy.');
    if (payload.automatic && !policy.autoSave) return error('AUTOSAVE_DISABLED', 'Automatic memory saving is disabled by policy.');
    if (containsSensitive(payload, '')) return error('SENSITIVE_CONTENT', 'Sensitive content was not saved.', { blocked: policy.blockedPatterns });
    let item;
    try { item = normalizeItem(payload, new Date().toISOString(), this.maxContentLength); } catch (cause) { return error(cause.code || 'INVALID_CONTENT', cause.message); }
    if (item.content.length > this.maxContentLength) return error('CONTENT_TOO_LONG', 'Memory content is too long.');
    if (containsSensitive(item.content) || containsSensitive(item.source)) return error('SENSITIVE_CONTENT', 'Sensitive content was not saved.', { blocked: policy.blockedPatterns });
    const count = tableValues(this.items).filter((entry) => entry.scope === scope && !entry.deletedAt).length;
    if (count >= this.maxItems) return error('LIMIT_REACHED', 'Memory limit reached. Delete an item before adding another.');
    const id = payload.id ? String(payload.id).slice(0, 120) : `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const value = { id, scope, ...item, createdAt: item.updatedAt, revision: 1, deletedAt: null };
    await this.items.put(id, value);
    if (value.source.label || value.source.uri) await this.sources.put(`${scope}:${id}`, { id: `${scope}:${id}`, scope, memoryId: id, ...value.source });
    await this.revisions.put(`${scope}:${id}:1`, { id: `${scope}:${id}:1`, scope, memoryId: id, revision: 1, action: 'create', at: item.updatedAt, snapshot: value });
    await this.log(scope, 'create', true, { memoryId: id });
    return { ok: true, value };
  }

  async update(scope, payload = {}) {
    const id = String(payload.id || '');
    const current = this.items.get(id);
    if (!this.visible(current, scope, true)) return error('NOT_FOUND', 'Memory item not found.');
    if (containsSensitive(payload, '')) return error('SENSITIVE_CONTENT', 'Sensitive content was not saved.');
    let patch;
    try { patch = normalizeItem({ ...current, ...payload }, new Date().toISOString(), this.maxContentLength); } catch (cause) { return error(cause.code || 'INVALID_CONTENT', cause.message); }
    if (patch.content.length > this.maxContentLength) return error('CONTENT_TOO_LONG', 'Memory content is too long.');
    if (containsSensitive(patch.content) || containsSensitive(patch.source)) return error('SENSITIVE_CONTENT', 'Sensitive content was not saved.');
    const revision = Number(current.revision || 0) + 1;
    const value = { ...current, ...patch, revision, deletedAt: current.deletedAt || null };
    await this.items.put(id, value);
    if (value.source.label || value.source.uri) await this.sources.put(`${scope}:${id}`, { id: `${scope}:${id}`, scope, memoryId: id, ...value.source });
    await this.revisions.put(`${scope}:${id}:${revision}`, { id: `${scope}:${id}:${revision}`, scope, memoryId: id, revision, action: 'update', at: value.updatedAt, snapshot: value });
    await this.log(scope, 'update', true, { memoryId: id, revision });
    return { ok: true, value };
  }

  async remove(scope, payload = {}) {
    const id = String(payload.id || '');
    const current = this.items.get(id);
    if (!this.visible(current, scope, true)) return error('NOT_FOUND', 'Memory item not found.');
    const revision = Number(current.revision || 0) + 1;
    const value = { ...current, revision, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await this.items.put(id, value);
    await this.revisions.put(`${scope}:${id}:${revision}`, { id: `${scope}:${id}:${revision}`, scope, memoryId: id, revision, action: 'delete', at: value.updatedAt, snapshot: value });
    await this.log(scope, 'delete', true, { memoryId: id });
    return { ok: true, value };
  }

  async restore(scope, payload = {}) {
    const id = String(payload.id || '');
    const current = this.items.get(id);
    if (!this.visible(current, scope, true)) return error('NOT_FOUND', 'Memory item not found.');
    const revision = Number(current.revision || 0) + 1;
    const value = { ...current, revision, deletedAt: null, updatedAt: new Date().toISOString() };
    await this.items.put(id, value);
    await this.revisions.put(`${scope}:${id}:${revision}`, { id: `${scope}:${id}:${revision}`, scope, memoryId: id, revision, action: 'restore', at: value.updatedAt, snapshot: value });
    await this.log(scope, 'restore', true, { memoryId: id });
    return { ok: true, value };
  }

  async togglePolicy(scope, payload = {}) {
    const current = await this.policy(scope);
    const next = { ...current, enabled: payload.enabled === undefined ? (payload.autoSave === undefined ? !current.enabled : current.enabled) : Boolean(payload.enabled), autoSave: payload.autoSave === undefined ? current.autoSave : Boolean(payload.autoSave) };
    await this.policyTable.put(scope, next);
    await this.log(scope, 'toggle_policy', true, { enabled: next.enabled, autoSave: next.autoSave });
    return { ok: true, value: next };
  }

  async dispatch(scope, payload = {}) {
    const action = String(payload.action || 'status');
    try {
      if (action === 'status') return this.status(scope);
      if (action === 'list') return this.list(scope, payload);
      if (action === 'search') return this.search(scope, payload);
      if (action === 'create') return this.create(scope, payload);
      if (action === 'update') return this.update(scope, payload);
      if (action === 'delete') return this.remove(scope, payload);
      if (action === 'restore') return this.restore(scope, payload);
      if (action === 'toggle_policy') return this.togglePolicy(scope, payload);
      return error('UNKNOWN_ACTION', `Unsupported memory action: ${action}`);
    } catch (cause) {
      await this.log(scope, action, false, { message: cause?.message || String(cause) });
      return error('STORAGE_ERROR', cause?.message || 'Memory storage failed.');
    }
  }
}

export function resolveScope(payload, peer, policy = DEFAULT_POLICY) {
  return normalizeScope(policy.scopeMode === 'peer' ? undefined : payload?.scope, peer);
}

export async function handleRpc(repository, payload, peer) {
  const policy = await repository.policy(normalizeScope(undefined, peer));
  const scope = resolveScope(payload, peer, policy);
  return repository.dispatch(scope, payload);
}
