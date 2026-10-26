window.__ModuleLoader__.load({
  id: '@local/dsh_memory',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const ENDPOINT = 'dsh_memory';

    function translate(locale, key, fallback) {
      try {
        if (locale?.t) return locale.t(key) || fallback;
        if (locale?.get) return locale.get(key) || fallback;
      } catch (_) { /* use fallback */ }
      return fallback;
    }

    async function callRpc(connection, payload) {
      const rpc = connection?.rpc;
      if (!rpc) throw new Error('Memory connection is unavailable.');
      if (typeof rpc.call === 'function') return rpc.call(ENDPOINT, payload);
      if (typeof rpc.request === 'function') return rpc.request(ENDPOINT, payload);
      if (typeof rpc.invoke === 'function') return rpc.invoke(ENDPOINT, payload);
      throw new Error('Memory RPC is unavailable.');
    }

    function Button({ children, onClick, disabled, danger = false }) {
      return h('button', { type: 'button', onClick, disabled, style: {
        border: '1px solid var(--dsw-alias-border-color, rgba(127,127,127,.28))', borderRadius: 8,
        padding: '7px 11px', background: danger ? 'var(--dsw-alias-danger-bg, transparent)' : 'var(--dsw-alias-control-bg, transparent)',
        color: danger ? 'var(--dsw-alias-danger-fg, var(--dsw-alias-text-color, inherit))' : 'var(--dsw-alias-text-color, inherit)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .55 : 1,
      } }, children);
    }

    function Sidebar({ onOpen, active }) {
      return h('button', { type: 'button', onClick: onOpen, 'aria-current': active ? 'page' : undefined, style: {
        width: '100%', display: 'flex', alignItems: 'center', gap: 9, border: 0, borderRadius: 8, padding: '9px 12px',
        background: active ? 'var(--dsw-alias-selected-bg, rgba(127,127,127,.15))' : 'transparent', color: 'var(--dsw-alias-text-color, inherit)', textAlign: 'left', cursor: 'pointer',
      } }, h('span', { 'aria-hidden': true }, '🧠'), h('span', null, 'Memory'));
    }

    function MemoryPanel({ connection, locale, onClose }) {
      const [items, setItems] = React.useState([]);
      const [status, setStatus] = React.useState(null);
      const [query, setQuery] = React.useState('');
      const [content, setContent] = React.useState('');
      const [source, setSource] = React.useState('');
      const [error, setError] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [showDeleted, setShowDeleted] = React.useState(false);

      const refresh = React.useCallback(async (nextQuery = query) => {
        setBusy(true); setError('');
        try {
          const [listResult, statusResult] = await Promise.all([
            callRpc(connection, nextQuery.trim() ? { action: 'search', query: nextQuery, includeDeleted: showDeleted } : { action: 'list', includeDeleted: showDeleted }),
            callRpc(connection, { action: 'status' }),
          ]);
          if (!listResult?.ok) throw new Error(listResult.error?.message || 'Unable to load memories.');
          if (!statusResult?.ok) throw new Error(statusResult.error?.message || 'Unable to load memory status.');
          setItems(listResult.value || []); setStatus(statusResult.value || null);
        } catch (cause) { setError(cause?.message || 'Unable to load memories.'); }
        finally { setBusy(false); }
      }, [connection, query, showDeleted]);

      React.useEffect(() => { refresh(''); }, []);

      async function action(payload) {
        setBusy(true); setError('');
        try {
          const result = await callRpc(connection, payload);
          if (!result?.ok) throw new Error(result.error?.message || 'Memory action failed.');
          await refresh();
        } catch (cause) { setError(cause?.message || 'Memory action failed.'); }
        finally { setBusy(false); }
      }

      async function create(event) {
        event.preventDefault();
        if (!content.trim()) return;
        await action({ action: 'create', content, source: source.trim() ? { kind: 'manual', label: source.trim() } : undefined });
        setContent(''); setSource('');
      }

      return h('section', { style: { color: 'var(--dsw-alias-text-color, inherit)', background: 'var(--dsw-alias-surface-bg, transparent)', minHeight: '100%', padding: 24, maxWidth: 900, boxSizing: 'border-box' } },
        h('header', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 } },
          h('div', null, h('h1', { style: { fontSize: 22, margin: 0 } }, translate(locale, 'memory.title', 'Memory')), h('p', { style: { margin: '7px 0 0', lineHeight: 1.5, color: 'var(--dsw-alias-secondary-text-color, inherit)', maxWidth: 650 } }, translate(locale, 'memory.description', 'Save useful, scoped notes for later. Sensitive content such as passwords, tokens, secrets, and card numbers is never stored.'))),
          onClose && h(Button, { onClick: onClose }, translate(locale, 'common.close', 'Close'))
        ),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', borderBottom: '1px solid var(--dsw-alias-border-color, rgba(127,127,127,.2))', paddingBottom: 14, marginBottom: 18 } },
          h('label', { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' } }, h('input', { type: 'checkbox', checked: Boolean(status?.enabled), onChange: (event) => action({ action: 'toggle_policy', enabled: event.target.checked }) }), translate(locale, 'memory.enabled', 'Memory enabled')),
          h('label', { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' } }, h('input', { type: 'checkbox', checked: status?.autoSave !== false, onChange: (event) => action({ action: 'toggle_policy', autoSave: event.target.checked }) }), translate(locale, 'memory.autoSave', 'Automatic saving')),
          h('span', { style: { fontSize: 13, color: 'var(--dsw-alias-secondary-text-color, inherit)' } }, status ? `${status.total} saved · ${status.revisions} revisions` : translate(locale, 'common.loading', 'Loading…')),
          h('label', { style: { display: 'flex', alignItems: 'center', gap: 7, marginLeft: 'auto', fontSize: 13 } }, h('input', { type: 'checkbox', checked: showDeleted, onChange: (event) => { setShowDeleted(event.target.checked); } }), translate(locale, 'memory.showDeleted', 'Show deleted'))
        ),
        h('form', { onSubmit: create, style: { display: 'grid', gap: 8, marginBottom: 20 } },
          h('textarea', { value: content, onChange: (event) => setContent(event.target.value), placeholder: translate(locale, 'memory.placeholder', 'Write a memory…'), rows: 3, style: { width: '100%', boxSizing: 'border-box', resize: 'vertical', borderRadius: 8, padding: 10, color: 'var(--dsw-alias-text-color, inherit)', background: 'var(--dsw-alias-input-bg, transparent)', border: '1px solid var(--dsw-alias-border-color, rgba(127,127,127,.3))' } }),
          h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } }, h('input', { value: source, onChange: (event) => setSource(event.target.value), placeholder: translate(locale, 'memory.sourcePlaceholder', 'Source (optional)'), style: { flex: 1, borderRadius: 8, padding: 8, color: 'var(--dsw-alias-text-color, inherit)', background: 'var(--dsw-alias-input-bg, transparent)', border: '1px solid var(--dsw-alias-border-color, rgba(127,127,127,.3))' } }), h(Button, { disabled: busy || !content.trim() }, translate(locale, 'common.save', 'Save')))
        ),
        h('div', { style: { display: 'flex', gap: 8, marginBottom: 14 } }, h('input', { value: query, onChange: (event) => setQuery(event.target.value), onKeyDown: (event) => { if (event.key === 'Enter') refresh(); }, placeholder: translate(locale, 'memory.searchPlaceholder', 'Search memories'), style: { flex: 1, borderRadius: 8, padding: 8, color: 'var(--dsw-alias-text-color, inherit)', background: 'var(--dsw-alias-input-bg, transparent)', border: '1px solid var(--dsw-alias-border-color, rgba(127,127,127,.3))' } }), h(Button, { onClick: () => refresh(), disabled: busy }, translate(locale, 'common.search', 'Search'))),
        error && h('div', { role: 'alert', style: { padding: 10, marginBottom: 12, borderRadius: 8, color: 'var(--dsw-alias-danger-fg, inherit)', background: 'var(--dsw-alias-danger-bg, rgba(180,40,40,.12))' } }, error),
        !busy && !items.length && h('div', { style: { padding: '30px 12px', textAlign: 'center', color: 'var(--dsw-alias-secondary-text-color, inherit)' } }, translate(locale, 'memory.empty', 'No memories yet. Add a short note above.')),
        h('div', { style: { display: 'grid', gap: 10 } }, items.map((item) => h('article', { key: item.id, style: { border: '1px solid var(--dsw-alias-border-color, rgba(127,127,127,.2))', borderRadius: 10, padding: 13, opacity: item.deletedAt ? .62 : 1 } },
          h('div', { style: { whiteSpace: 'pre-wrap', lineHeight: 1.5 } }, item.content),
          h('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 9, fontSize: 12, color: 'var(--dsw-alias-secondary-text-color, inherit)' } }, h('span', null, item.source?.label || item.source?.kind || translate(locale, 'memory.manual', 'Manual')), h('span', null, `v${item.revision || 1}`), h('span', null, new Date(item.updatedAt).toLocaleString()), item.deletedAt && h('span', null, translate(locale, 'memory.deleted', 'Deleted'))),
          h('div', { style: { display: 'flex', gap: 7, marginTop: 10 } }, item.deletedAt ? h(Button, { onClick: () => action({ action: 'restore', id: item.id }), disabled: busy }, translate(locale, 'common.restore', 'Restore')) : h(Button, { onClick: () => action({ action: 'delete', id: item.id }), disabled: busy, danger: true }, translate(locale, 'common.delete', 'Delete')))
        )))
      );
    }

    return {
      inject: ['connection', 'locale', 'slots'],
      apply(ctx) {
        let open = true;
        let panelDisposer;
        const SidebarEntry = () => h(Sidebar, { active: open, onOpen: () => { open = true; } });
        const MainEntry = () => h(MemoryPanel, { connection: ctx.connection, locale: ctx.locale });
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'dsh_memory', key: 'dsh_memory', order: 30, title: 'Memory', icon: '🧠' }, SidebarEntry));
        panelDisposer = ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', id: 'dsh_memory', key: 'dsh_memory', order: 30, title: 'Memory' }, MainEntry));
        ctx.effect?.(() => { if (typeof panelDisposer === 'function') panelDisposer(); });
      },
    };
  },
});
