window.__ModuleLoader__.load({
  id: '@local/dsh-memory',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const ENDPOINT = 'dsh-memory';

    const zh = {
      title: '记忆', description: '保存有用且限定范围的笔记，之后可随时引用。密码、令牌、密钥、卡号等敏感内容永远不会被保存。',
      enabled: '启用记忆', autoSave: '自动保存', showDeleted: '显示已删除', search: '搜索', save: '保存', delete: '删除', restore: '恢复',
      placeholder: '写一条记忆…', sourcePlaceholder: '来源（可选）', searchPlaceholder: '搜索记忆', empty: '还没有记忆，先在上方添加一条。',
      loading: '加载中…', deleted: '已删除', manual: '手动', failed: '操作失败：', unavailable: '无法连接宿主，请刷新页面。',
      stats: (total, revisions) => `${total} 条记忆 · ${revisions} 个版本`,
      settingsTitle: '记忆设置', settingsDesc: '在这里启用或停用记忆、导出或清空全部记忆。新增、编辑、删除单条记忆仍在左侧「Memory」面板中完成。',
      dataTitle: '记忆数据', dataDesc: '导出会得到 JSON 备份；清空会永久删除全部记忆、来源与历史版本，且不可恢复。',
      export: '导出 JSON', exported: '已导出记忆备份。', clear: '清空全部记忆', clearConfirm: '确认清空（不可恢复）', clearCancel: '取消清空', cleared: '记忆已清空。',
    };
    const en = {
      title: 'Memory', description: 'Save useful, scoped notes for later. Sensitive content such as passwords, tokens, secrets, and card numbers is never stored.',
      enabled: 'Memory enabled', autoSave: 'Automatic saving', showDeleted: 'Show deleted', search: 'Search', save: 'Save', delete: 'Delete', restore: 'Restore',
      placeholder: 'Write a memory…', sourcePlaceholder: 'Source (optional)', searchPlaceholder: 'Search memories', empty: 'No memories yet. Add a short note above.',
      loading: 'Loading…', deleted: 'Deleted', manual: 'Manual', failed: 'Something went wrong: ', unavailable: 'Cannot reach the host. Refresh the page.',
      stats: (total, revisions) => `${total} saved · ${revisions} revisions`,
      settingsTitle: 'Memory settings', settingsDesc: 'Enable or disable memory, export a backup, or clear every memory. Adding and editing individual memories stays in the Memory panel.',
      dataTitle: 'Memory data', dataDesc: 'Export downloads a JSON backup; clearing permanently deletes every memory, source, and revision.',
      export: 'Export JSON', exported: 'Memory backup exported.', clear: 'Clear all memories', clearConfirm: 'Confirm clear (cannot undo)', clearCancel: 'Cancel', cleared: 'All memories cleared.',
    };

    function translate(ctx, key, ...args) {
      let active = 'en';
      try { active = String(ctx.locale?.getSnapshot?.()?.active || 'en'); } catch {}
      const dict = active.toLowerCase().startsWith('zh') ? zh : en;
      const value = dict[key] ?? en[key] ?? key;
      return typeof value === 'function' ? value(...args) : value;
    }

    async function callRpc(connection, payload) {
      const rpc = connection?.rpc;
      if (!rpc?.call) throw new Error('Host connection unavailable.');
      const reply = await rpc.call('/api', ENDPOINT, payload);
      if (reply?.ok === false) throw new Error(reply.error?.message || 'Memory request failed.');
      if (reply && typeof reply === 'object' && 'value' in reply) return reply.value;
      return reply;
    }

    const styles = {
      page: { color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-base)', minHeight: '100%', padding: '24px 28px 40px', boxSizing: 'border-box' },
      wrap: { maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 },
      head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
      title: { margin: 0, fontSize: 22, fontWeight: 600, lineHeight: 1.3 },
      sub: { margin: '6px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)', maxWidth: 640 },
      card: { background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 12, padding: 16 },
      row: { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
      toggle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--dsw-alias-label-primary)', cursor: 'pointer' },
      meta: { fontSize: 12.5, color: 'var(--dsw-alias-label-secondary)' },
      input: { width: '100%', boxSizing: 'border-box', borderRadius: 8, padding: '9px 11px', color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid var(--dsw-alias-border-l1)', fontSize: 13.5, outline: 'none' },
      primary: { border: 0, borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: 'var(--dsw-alias-bg-base)', background: 'var(--dsw-alias-brand-primary)' },
      ghost: { border: '1px solid var(--dsw-alias-border-l2)', background: 'transparent', color: 'var(--dsw-alias-label-primary)', borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer' },
      danger: { border: '1px solid var(--dsw-alias-border-l2)', background: 'transparent', color: 'var(--dsw-alias-state-error-primary)', borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer' },
      disabled: { opacity: .55, cursor: 'default' },
      error: { role: 'alert', padding: '10px 12px', borderRadius: 8, fontSize: 13, color: 'var(--dsw-alias-state-error-primary)', background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid var(--dsw-alias-state-error-primary)' },
      empty: { padding: '34px 12px', textAlign: 'center', fontSize: 13.5, color: 'var(--dsw-alias-label-secondary)', border: '1px dashed var(--dsw-alias-border-l1)', borderRadius: 10 },
      item: { border: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-layer-1)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 9 },
      itemText: { whiteSpace: 'pre-wrap', lineHeight: 1.55, fontSize: 13.5 },
      itemMeta: { display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'var(--dsw-alias-label-secondary)' },
      chip: { padding: '1px 8px', borderRadius: 999, border: '1px solid var(--dsw-alias-border-l1)', fontSize: 11.5 },
    };

    function MemoryPanel({ ctx }) {
      const [items, setItems] = React.useState([]);
      const [status, setStatus] = React.useState(null);
      const [query, setQuery] = React.useState('');
      const [content, setContent] = React.useState('');
      const [source, setSource] = React.useState('');
      const [error, setError] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [showDeleted, setShowDeleted] = React.useState(false);
      const [, tick] = React.useState(0);

      React.useEffect(() => {
        let stop;
        try { stop = ctx.locale?.subscribe?.(() => tick((n) => n + 1)); } catch {}
        return () => { try { stop?.(); } catch {} };
      }, []);

      const t = (key, ...args) => translate(ctx, key, ...args);

      const refresh = React.useCallback(async () => {
        setBusy(true); setError('');
        try {
          const [listResult, statusResult] = await Promise.all([
            callRpc(ctx.connection, query.trim() ? { action: 'search', query, includeDeleted: showDeleted } : { action: 'list', includeDeleted: showDeleted }),
            callRpc(ctx.connection, { action: 'status' }),
          ]);
          if (!listResult?.ok) throw new Error(listResult.error?.message || t('failed'));
          if (!statusResult?.ok) throw new Error(statusResult.error?.message || t('failed'));
          setItems(listResult.value || []);
          setStatus(statusResult.value || null);
        } catch (cause) {
          setError(cause?.message || t('unavailable'));
        } finally { setBusy(false); }
      }, [query, showDeleted]);

      React.useEffect(() => { refresh(); }, []);

      async function action(payload) {
        setBusy(true); setError('');
        try {
          const result = await callRpc(ctx.connection, payload);
          if (!result?.ok) throw new Error(result.error?.message || t('failed'));
          await refresh();
        } catch (cause) { setError(cause?.message || t('failed')); }
        finally { setBusy(false); }
      }

      async function create(event) {
        event.preventDefault();
        if (!content.trim()) return;
        await action({ action: 'create', content, source: source.trim() ? { kind: 'manual', label: source.trim() } : undefined });
        setContent(''); setSource('');
      }

      return h('div', { style: styles.page },
        h('div', { style: styles.wrap },
          h('header', { style: styles.head },
            h('div', null,
              h('h1', { style: styles.title }, t('title')),
              h('p', { style: styles.sub }, t('description'))),
            h('span', { style: { ...styles.chip, padding: '3px 10px', color: 'var(--dsw-alias-label-secondary)' } },
              status ? t('stats', status.total, status.revisions) : t('loading'))),
          error ? h('div', { style: styles.error }, error) : null,
          h('section', { style: styles.card },
            h('div', { style: { ...styles.row, marginBottom: 14 } },
              h('label', { style: styles.toggle },
                h('input', { type: 'checkbox', checked: status?.enabled !== false, disabled: busy, onChange: (e) => action({ action: 'toggle_policy', enabled: e.target.checked }) }),
                t('enabled')),
              h('label', { style: styles.toggle },
                h('input', { type: 'checkbox', checked: status?.autoSave !== false, disabled: busy, onChange: (e) => action({ action: 'toggle_policy', autoSave: e.target.checked }) }),
                t('autoSave')),
              h('label', { style: { ...styles.toggle, marginLeft: 'auto' } },
                h('input', { type: 'checkbox', checked: showDeleted, onChange: (e) => setShowDeleted(e.target.checked) }),
                t('showDeleted'))),
            h('form', { onSubmit: create, style: { display: 'flex', flexDirection: 'column', gap: 9 } },
              h('textarea', { value: content, rows: 3, placeholder: t('placeholder'), onChange: (e) => setContent(e.target.value), style: { ...styles.input, resize: 'vertical', minHeight: 74 } }),
              h('div', { style: { display: 'flex', gap: 8 } },
                h('input', { value: source, placeholder: t('sourcePlaceholder'), onChange: (e) => setSource(e.target.value), style: styles.input }),
                h('button', { type: 'submit', disabled: busy || !content.trim(), style: { ...styles.primary, ...(busy || !content.trim() ? styles.disabled : {}) } }, t('save'))))),
          h('div', { style: { display: 'flex', gap: 8 } },
            h('input', { value: query, placeholder: t('searchPlaceholder'), onChange: (e) => setQuery(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') refresh(); }, style: styles.input }),
            h('button', { type: 'button', disabled: busy, onClick: refresh, style: { ...styles.ghost, ...(busy ? styles.disabled : {}) } }, t('search'))),
          !busy && !items.length ? h('div', { style: styles.empty }, t('empty')) : null,
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
            items.map((item) => h('article', { key: item.id, style: { ...styles.item, opacity: item.deletedAt ? .62 : 1 } },
              h('div', { style: styles.itemText }, item.content),
              h('div', { style: styles.itemMeta },
                h('span', { style: styles.chip }, item.source?.label || item.source?.kind || t('manual')),
                h('span', null, `v${item.revision || 1}`),
                h('span', null, new Date(item.updatedAt).toLocaleString()),
                item.deletedAt ? h('span', null, t('deleted')) : null),
              h('div', { style: { display: 'flex', gap: 8 } },
                item.deletedAt
                  ? h('button', { type: 'button', disabled: busy, onClick: () => action({ action: 'restore', id: item.id }), style: styles.ghost }, t('restore'))
                  : h('button', { type: 'button', disabled: busy, onClick: () => action({ action: 'delete', id: item.id }), style: styles.danger }, t('delete')))))))
      );
    }

    function SettingsPage({ ctx }) {
      const [status, setStatus] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState('');
      const [notice, setNotice] = React.useState('');
      const [confirmClear, setConfirmClear] = React.useState(false);
      const t = (key, ...args) => translate(ctx, key, ...args);

      const load = React.useCallback(async () => {
        setBusy(true); setError('');
        try {
          const result = await callRpc(ctx.connection, { action: 'status' });
          if (!result?.ok) throw new Error(result?.error?.message || t('failed'));
          setStatus(result.value || null);
        } catch (cause) { setError(cause?.message || t('unavailable')); }
        finally { setBusy(false); }
      }, []);

      React.useEffect(() => { load(); }, []);

      async function act(payload, message) {
        setBusy(true); setError(''); setNotice('');
        try {
          const result = await callRpc(ctx.connection, payload);
          if (!result?.ok) throw new Error(result?.error?.message || t('failed'));
          if (message) setNotice(message);
          await load();
          return result.value;
        } catch (cause) { setError(cause?.message || t('failed')); return null; }
        finally { setBusy(false); }
      }

      async function exportJson() {
        const value = await act({ action: 'export' });
        if (!value) return;
        try {
          const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `dsh-memory-${new Date().toISOString().slice(0, 10)}.json`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          setNotice(t('exported'));
        } catch { setError(t('failed')); }
      }

      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 720 } },
        h('header', null,
          h('h2', { style: { margin: 0, fontSize: 18, fontWeight: 600 } }, t('settingsTitle')),
          h('p', { style: { margin: '6px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' } }, t('settingsDesc'))),
        error ? h('div', { style: { ...styles.error, padding: '10px 12px', borderRadius: 8, fontSize: 13, color: 'var(--dsw-alias-state-error-primary)', background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid var(--dsw-alias-state-error-primary)' } }, error) : null,
        notice ? h('div', { role: 'status', style: { fontSize: 13, color: 'var(--dsw-alias-state-success-primary)' } }, notice) : null,
        h('section', { style: { border: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-layer-1)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 } },
          h('label', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 13.5 } },
            h('span', null, t('enabled')),
            h('input', { type: 'checkbox', role: 'switch', checked: status?.enabled !== false, disabled: busy, onChange: (e) => act({ action: 'toggle_policy', enabled: e.target.checked }) })),
          h('label', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 13.5 } },
            h('span', null, t('autoSave')),
            h('input', { type: 'checkbox', role: 'switch', checked: status?.autoSave !== false, disabled: busy, onChange: (e) => act({ action: 'toggle_policy', autoSave: e.target.checked }) })),
          h('p', { style: { margin: 0, fontSize: 12.5, color: 'var(--dsw-alias-label-secondary)' } }, status ? t('stats', status.total, status.revisions) : t('loading'))),
        h('section', { style: { border: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-layer-1)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 } },
          h('strong', { style: { fontSize: 13.5 } }, t('dataTitle')),
          h('p', { style: { margin: 0, fontSize: 12.5, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' } }, t('dataDesc')),
          h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            h('button', { type: 'button', disabled: busy, onClick: exportJson, style: { ...styles.ghost, ...(busy ? styles.disabled : {}) } }, t('export')),
            confirmClear
              ? h('button', { type: 'button', disabled: busy, onClick: async () => { await act({ action: 'clear', confirm: true }, t('cleared')); setConfirmClear(false); }, style: styles.danger }, t('clearConfirm'))
              : h('button', { type: 'button', disabled: busy || !status?.total, onClick: () => setConfirmClear(true), style: { ...styles.danger, ...(busy || !status?.total ? styles.disabled : {}) } }, t('clear'))),
          confirmClear ? h('button', { type: 'button', onClick: () => setConfirmClear(false), style: { border: 0, background: 'none', padding: 0, fontSize: 12.5, color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer', textAlign: 'left' } }, t('clearCancel')) : null));
    }

    function SidebarEntry({ size = 20 }) {
      return h('span', { style: { fontSize: Math.max(13, size * 0.74), lineHeight: 1 }, 'aria-hidden': 'true' }, '🧠');
    }

    return {
      inject: ['connection', 'locale', 'slots'],
      apply(ctx) {
        ctx.effect(() => {
          const d1 = ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'dsh-memory', order: 34, label: () => 'Memory' }, (props) => h(SidebarEntry, props || {})));
          const d2 = ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'dsh-memory' }, () => h(MemoryPanel, { ctx })));
          const d3 = ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'memory', order: 36, label: () => 'Memory' }, () => h(SettingsPage, { ctx })));
          return () => { try { d1?.(); } catch {} try { d2?.(); } catch {} try { d3?.(); } catch {} };
        });
      },
    };
  },
});
