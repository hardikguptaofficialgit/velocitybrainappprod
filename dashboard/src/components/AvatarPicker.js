import React, { useEffect, useMemo, useState } from 'react';

import { Check, X } from './Icons';

export default function AvatarPicker({
  value,
  options = [],
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

  const previewShapeClass =
    shape === 'rounded-3xl' ? 'rounded-3xl' : 'rounded-full';

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
        className="
          flex
          w-full
          items-center
          justify-between
          gap-4
          rounded-2xl
          border
          border-zinc-800
          bg-[#111111]
          px-4
          py-3
          text-left
          transition-colors
          duration-200
          hover:bg-[#151515]
        "
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`
              h-12
              w-12
              overflow-hidden
              bg-[#1a1a1a]
              ${previewShapeClass}
            `}
          >
            {activeOption ? (
              <img
                src={activeOption.url}
                alt={activeOption.label}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {activeOption?.label || triggerLabel}
            </p>

            <p className="mt-1 truncate text-xs text-zinc-500">
              {helperText}
            </p>
          </div>
        </div>

        <span
          className="
            inline-flex
            items-center
            rounded-full
            border
            border-zinc-700
            px-3
            py-1
            text-[11px]
            font-medium
            text-zinc-300
          "
        >
          {triggerLabel}
        </span>
      </button>

      {open ? (
        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-black/70
            p-4
          "
        >
          <div
            className="
              w-full
              max-w-md
              rounded-3xl
              border
              border-zinc-800
              bg-[#0d0d0d]
              p-5
            "
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {title}
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  {description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="
                  flex
                  h-8
                  w-8
                  items-center
                  justify-center
                  rounded-full
                  border
                  border-zinc-800
                  text-zinc-400
                  transition-colors
                  duration-200
                  hover:bg-[#181818]
                  hover:text-white
                "
                aria-label="Close avatar picker"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
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
                    className={`
                      relative
                      overflow-hidden
                      rounded-2xl
                      border
                      p-2
                      transition-colors
                      duration-200
                      ${
                        active
                          ? 'border-white bg-[#1a1a1a]'
                          : 'border-zinc-800 bg-[#141414] hover:bg-[#181818]'
                      }
                    `}
                    aria-label={`Choose ${option.label}`}
                  >
                    <div
                      className={`
                        overflow-hidden
                        bg-[#090909]
                        ${previewShapeClass}
                      `}
                    >
                      <img
                        src={option.url}
                        alt={option.label}
                        className="h-20 w-full object-cover"
                      />
                    </div>

                    <p
                      className="
                        mt-2
                        truncate
                        text-center
                        text-[11px]
                        text-zinc-400
                      "
                    >
                      {option.label}
                    </p>

                    {active ? (
                      <span
                        className="
                          absolute
                          right-2
                          top-2
                          inline-flex
                          h-5
                          w-5
                          items-center
                          justify-center
                          rounded-full
                          bg-white
                          text-black
                        "
                      >
                        <Check className="h-3 w-3" />
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