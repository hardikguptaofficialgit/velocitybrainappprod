import React from 'react';

import { COMPANY_SIZE_OPTIONS, WORKFLOW_OPTIONS } from '../lib/velaiOnboarding';

export function VelAiChipGroup({ label, options, value, onChange }) {
  return (
    <div className="mt-2 rounded-lg border border-zinc-800 bg-[#101010] p-2.5">
      {label && (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const optionValue = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? option : option.label;
          const active = value === optionValue;
          return (
            <button
              key={optionValue}
              type="button"
              onClick={() => onChange(optionValue)}
              className={`rounded-md border px-2.5 py-1 text-[11px] ${
                active
                  ? 'border-[#EA803A] bg-[#EA803A]/15 text-[#f4a066]'
                  : 'border-zinc-800 bg-[#141414] text-zinc-400'
              }`}
            >
              {optionLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Inline chips for VelAI chat; avatar is chosen on the dedicated onboarding step. */
export function VelAiChatWidget({ widget, form, onPatch }) {
  if (!widget || widget === 'avatar') return null;

  if (widget === 'account_type') {
    return (
      <VelAiChipGroup
        label="Account type"
        options={[
          { value: 'company', label: 'Company' },
          { value: 'individual', label: 'Individual' }
        ]}
        value={form.accountType}
        onChange={(accountType) => onPatch({ accountType })}
      />
    );
  }

  if (widget === 'company_size') {
    return (
      <VelAiChipGroup
        label="Team size"
        options={COMPANY_SIZE_OPTIONS}
        value={form.companySize}
        onChange={(companySize) => onPatch({ companySize })}
      />
    );
  }

  if (widget === 'workflow') {
    return (
      <VelAiChipGroup
        label="Primary workflow"
        options={WORKFLOW_OPTIONS}
        value={form.agents?.primaryWorkflow}
        onChange={(primaryWorkflow) => onPatch({
          agents: { ...(form.agents || {}), primaryWorkflow }
        })}
      />
    );
  }

  return null;
}
