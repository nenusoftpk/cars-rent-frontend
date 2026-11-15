// PATH: src/features/staff/PermissionMatrix.jsx   (REPLACE your existing file)
'use client';
import { useMemo } from 'react';
import { Bound } from '@/components/forms/Form';

/**
 * The rows / columns are built from the permission strings the BACKEND allows
 * (GET /employees/permissions -> allowedPermissions), so the matrix can never offer
 * a permission the server would reject. Works with "customers.view" and "customers:view".
 *
 * value    = array of permission strings   |   options = allowedPermissions
 */
const split = (p) => {
  const i = p.search(/[.:]/);
  return i < 0 ? [p, 'access'] : [p.slice(0, i), p.slice(i + 1)];
};
const pretty = (s) => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const ORDER = ['view', 'create', 'update', 'edit', 'delete', 'print', 'export'];

export default function PermissionMatrix({ name, value, onChange, options = [] }) {
  const { rows, actions } = useMemo(() => {
    const map = new Map();
    const acts = new Set();
    options.forEach((perm) => {
      const [mod, act] = split(perm);
      acts.add(act);
      if (!map.has(mod)) map.set(mod, {});
      map.get(mod)[act] = perm;
    });
    const sorted = [...acts].sort((a, b) => {
      const ia = ORDER.indexOf(a);
      const ib = ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
    return { rows: [...map.entries()], actions: sorted };
  }, [options]);

  return (
    <Bound name={name} value={value} onChange={onChange}>
      {({ value: v = [], onChange: set }) => {
        const has = (p) => v.includes(p);
        const toggle = (p) => set(has(p) ? v.filter((x) => x !== p) : [...v, p]);
        const toggleRow = (perms) => {
          const all = perms.every(has);
          set(all ? v.filter((x) => !perms.includes(x)) : [...new Set([...v, ...perms])]);
        };

        if (!options.length) return <p className="text-sm text-muted">Loading permissions…</p>;
        return (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="table-clean min-w-[560px]">
                <thead>
                  <tr>
                    <th>Page</th>
                    {actions.map((a) => <th key={a} className="text-center">{pretty(a)}</th>)}
                    <th className="text-center">All</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([mod, perms]) => {
                    const list = Object.values(perms);
                    return (
                      <tr key={mod}>
                        <td className="font-medium">{pretty(mod)}</td>
                        {actions.map((a) => (
                          <td key={a} className="text-center">
                            {perms[a] ? (
                              <input
                                type="checkbox"
                                className="size-4 accent-primary"
                                checked={has(perms[a])}
                                onChange={() => toggle(perms[a])}
                                aria-label={`${pretty(mod)} - ${pretty(a)}`}
                              />
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                        ))}
                        <td className="text-center">
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={list.every(has)}
                            onChange={() => toggleRow(list)}
                            aria-label={`${pretty(mod)} - all`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">{v.length} of {options.length} permissions selected. The server checks these on every request.</p>
          </div>
        );
      }}
    </Bound>
  );
}