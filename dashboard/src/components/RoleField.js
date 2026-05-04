import React, { useEffect, useMemo, useState } from 'react';
import MinimalSelect from './MinimalSelect';

const roleOptions = [
  'Founder',
  'Engineer',
  'Developer',
  'Researcher',
  'Product Manager',
  'Designer',
  'Operations Lead',
  'Marketer',
  'Sales',
  'Student'
].map((r) => ({ value: r, label: r }));

const presetValues = new Set(roleOptions.map((o) => o.value));

const getModeFromValue = (value) => {
  if (!value) return '';
  return presetValues.has(value) ? value : 'other';
};

export default function RoleField({
  label = 'Role',
  value,
  onChange,
  className = ''
}) {
  const [mode, setMode] = useState(getModeFromValue(value));

  useEffect(() => {
    setMode(getModeFromValue(value));
  }, [value]);

  const options = useMemo(
    () => [
      { value: '', label: 'Select' },
      ...roleOptions,
      { value: 'other', label: 'Other' }
    ],
    []
  );

  return (
    <div className={`space-y-1 ${className}`}>
      <label className="text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </label>

      <div className="flex gap-2">
        <MinimalSelect
          value={mode}
          onChange={(next) => {
            setMode(next);

            if (!next) return onChange('');
            if (next === 'other') {
              if (presetValues.has(value)) onChange('');
              return;
            }

            onChange(next);
          }}
          options={options}
          className="h-9 text-sm"
        />

        {mode === 'other' && (
          <input
            value={presetValues.has(value) ? '' : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Custom"
            className="h-9 w-full rounded-md border border-zinc-800 bg-transparent px-2 text-sm text-zinc-200 outline-none focus:border-zinc-600"
          />
        )}
      </div>
    </div>
  );
}