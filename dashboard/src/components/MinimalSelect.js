import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Check, ChevronDown } from './Icons';

export default function MinimalSelect({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  className = '',
  buttonClassName = '',
  menuClassName = '',
  optionClassName = ''
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value]
  );

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-left text-sm text-white outline-none transition-all duration-200 focus:border-[#EA803A] focus:bg-[#1A1A1A] focus:ring-2 focus:ring-[#EA803A]/20 ${open ? 'border-[#EA803A]/70 bg-[#161616] shadow-[0_14px_40px_rgba(0,0,0,0.35)]' : 'hover:border-white/15 hover:bg-[#151515]'} ${buttonClassName}`}
      >
        <span className={`min-w-0 flex-1 truncate ${selectedOption ? 'text-white' : 'text-zinc-500'}`}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-zinc-400 transition-transform duration-200 ${open ? 'rotate-180 text-[#EA803A]' : ''}`} />
      </button>

      {open ? (
        <div className={`absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-white/10 bg-[#111111]/95 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur ${menuClassName}`}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value || '__empty__'}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${selected ? 'bg-[#EA803A]/10 text-white' : 'text-zinc-300 hover:bg-[#1A1A1A] hover:text-white'} ${optionClassName}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate">{option.label}</p>
                  {option.description ? (
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{option.description}</p>
                  ) : null}
                </div>
                {selected ? <Check className="h-4 w-4 flex-shrink-0 text-[#EA803A]" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
