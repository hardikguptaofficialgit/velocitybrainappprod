import React, { useEffect, useMemo, useState } from 'react';

import { Check, X } from './Icons';

export default function AvatarPicker({
  value,
  options,
  onChange,
  title = 'Choose an avatar',
  description = 'Pick one from our curated set.',
  triggerLabel = 'Choose avatar',
  helperText = 'Curated only',
  shape = 'rounded-full'
}) {
  const [open, setOpen] = useState(false);

  const activeOption = useMemo(
    () => options.find((option) => option.url === value) || options[0] || null,
    [options, value]
  );

  const previewShapeClass = shape === 'rounded-3xl' ? 'rounded-3xl' : 'rounded-full';

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#111111] px-4 py-3 text-left transition-colors duration-200 hover:border-white/20 hover:bg-[#151515]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className={`h-14 w-14 overflow-hidden border border-white/10 bg-[#060606] ${previewShapeClass}`}>
            {activeOption ? (
              <img src={activeOption.url} alt={activeOption.label} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{activeOption?.label || triggerLabel}</p>
            <p className="mt-1 truncate text-xs text-zinc-500">{helperText}</p>
          </div>
        </div>
        <span className="inline-flex flex-shrink-0 items-center rounded-full border border-[#EA803A]/30 bg-[#EA803A]/10 px-3 py-1 text-xs font-semibold text-[#f4a066]">
          {triggerLabel}
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0C0C0C] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">{title}</h3>
                <p className="mt-1 text-sm text-zinc-400">{description}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/10 bg-[#131313] p-2 text-zinc-400 transition-colors hover:text-white"
                aria-label="Close avatar picker"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {options.map((option) => {
                const active = value === option.url;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onChange(option.url);
                      setOpen(false);
                    }}
                    className={`group relative rounded-2xl border p-2 transition-all duration-200 ${
                      active
                        ? 'border-[#EA803A] bg-[#EA803A]/10 shadow-[0_0_0_1px_rgba(234,128,58,0.25)]'
                        : 'border-white/10 bg-[#101010] hover:border-white/20 hover:bg-[#171717]'
                    }`}
                    aria-label={`Choose ${option.label}`}
                  >
                    <div className={`overflow-hidden border border-white/10 bg-[#050505] ${previewShapeClass}`}>
                      <img src={option.url} alt={option.label} className="h-20 w-full object-cover" />
                    </div>
                    <p className="mt-2 truncate text-center text-[11px] font-medium text-zinc-300">{option.label}</p>
                    {active ? (
                      <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#EA803A] text-black">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
