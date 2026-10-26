import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryRepository, containsSensitive, handleRpc } from '../rpc.js';

class Domain {
  constructor() { this.tables = new Map(); }
  table(name) {
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    const map = this.tables.get(name);
    return { get: (k) => map.get(k), entries: () => map.entries(), values: () => map.values(), put: async (k, v) => map.set(k, v), delete: async (k) => map.delete(k) };
  }
}

test('sensitive fields and card-like values are rejected', () => {
  assert.equal(containsSensitive({ password: 'dont-save' }), true);
  assert.equal(containsSensitive('card 4111 1111 1111 1111'), true);
  assert.equal(containsSensitive('please save my password'), true);
  assert.equal(containsSensitive({ topic: 'meeting notes' }), false);
});

test('memory is isolated by peer scope and supports restore', async () => {
  const repo = new MemoryRepository(new Domain());
  const first = await handleRpc(repo, { action: 'create', content: 'private note' }, { id: 'peer-a' });
  assert.equal(first.ok, true);
  const hidden = await handleRpc(repo, { action: 'list' }, { id: 'peer-b' });
  assert.equal(hidden.value.length, 0);
  const visible = await handleRpc(repo, { action: 'list' }, { id: 'peer-a' });
  assert.equal(visible.value.length, 1);
  await handleRpc(repo, { action: 'delete', id: first.value.id }, { id: 'peer-a' });
  assert.equal((await handleRpc(repo, { action: 'list' }, { id: 'peer-a' })).value.length, 0);
  await handleRpc(repo, { action: 'restore', id: first.value.id }, { id: 'peer-a' });
  assert.equal((await handleRpc(repo, { action: 'list' }, { id: 'peer-a' })).value.length, 1);
});

test('policy can disable writes and automatic saves', async () => {
  const repo = new MemoryRepository(new Domain());
  await handleRpc(repo, { action: 'toggle_policy', autoSave: false }, { id: 'peer-a' });
  const automatic = await handleRpc(repo, { action: 'create', content: 'blocked', automatic: true }, { id: 'peer-a' });
  assert.equal(automatic.error.code, 'AUTOSAVE_DISABLED');
  await handleRpc(repo, { action: 'toggle_policy', enabled: false }, { id: 'peer-a' });
  const result = await handleRpc(repo, { action: 'create', content: 'blocked' }, { id: 'peer-a' });
  assert.equal(result.error.code, 'POLICY_DISABLED');
});
