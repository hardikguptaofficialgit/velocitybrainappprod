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
          group
          relative
          flex
          w-full
          items-center
          justify-between
          gap-4
          rounded-[28px]
          bg-[#111111]
          px-4
          py-3.5
          text-left
          transition-all
          duration-300
          ease-out

          hover:bg-[#151515]
          hover:scale-[1.01]

          active:scale-[0.99]
        "
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`
              h-14
              w-14
              overflow-hidden
              bg-[#1a1a1a]
              shadow-[0_10px_30px_rgba(0,0,0,0.35)]
              transition-transform
              duration-300
              group-hover:scale-[1.03]
              ${previewShapeClass}
            `}
          >
            {activeOption ? (
              <img
                src={activeOption.url}
                alt={activeOption.label}
                className="
                  h-full
                  w-full
                  object-cover
                  transition-transform
                  duration-500
                  group-hover:scale-105
                "
              />
            ) : null}
          </div>

          <div className="min-w-0">
            <p
              className="
                truncate
                text-sm
                font-semibold
                tracking-[-0.02em]
                text-white
              "
            >
              {activeOption?.label || triggerLabel}
            </p>

            <p
              className="
                mt-1
                truncate
                text-xs
                font-medium
                text-zinc-500
              "
            >
              {helperText}
            </p>
          </div>
        </div>

        <span
          className="
            inline-flex
            flex-shrink-0
            items-center
            rounded-full
            bg-white/[0.06]
            px-3
            py-1.5
            text-[11px]
            font-semibold
            tracking-wide
            text-zinc-300
            transition-all
            duration-300

            group-hover:bg-white/[0.09]
            group-hover:text-white
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
            bg-black/60
            p-4
            backdrop-blur-xl
            animate-in
            fade-in
            duration-300
          "
        >
          <div
            className="
              w-full
              max-w-md
              rounded-[32px]
              bg-[#0d0d0d]/95
              p-5
              shadow-[0_20px_80px_rgba(0,0,0,0.6)]
              animate-in
              zoom-in-95
              fade-in
              duration-300
            "
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  className="
                    text-[20px]
                    font-bold
                    tracking-[-0.03em]
                    text-white
                  "
                >
                  {title}
                </h3>

                <p
                  className="
                    mt-1.5
                    text-sm
                    leading-relaxed
                    text-zinc-500
                  "
                >
                  {description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-full
                  bg-white/[0.05]
                  text-zinc-500
                  transition-all
                  duration-200

                  hover:bg-white/[0.08]
                  hover:text-white
                  hover:rotate-90
                "
                aria-label="Close avatar picker"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {options.map((option, index) => {
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
                      group
                      relative
                      overflow-hidden
                      rounded-[24px]
                      bg-[#141414]
                      p-2
                      transition-all
                      duration-300
                      ease-out

                      hover:bg-[#1a1a1a]
                      hover:-translate-y-1
                      hover:shadow-[0_14px_40px_rgba(0,0,0,0.35)]

                      active:scale-[0.98]

                      ${
                        active
                          ? 'bg-[#1d1d1d] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
                          : ''
                      }
                    `}
                    style={{
                      animationDelay: `${index * 35}ms`
                    }}
                    aria-label={`Choose ${option.label}`}
                  >
                    <div
                      className={`
                        overflow-hidden
                        bg-[#090909]
                        transition-transform
                        duration-300
                        group-hover:scale-[1.02]
                        ${previewShapeClass}
                      `}
                    >
                      <img
                        src={option.url}
                        alt={option.label}
                        className="
                          h-20
                          w-full
                          object-cover
                          transition-transform
                          duration-500
                          group-hover:scale-105
                        "
                      />
                    </div>

                    <p
                      className="
                        mt-2.5
                        truncate
                        text-center
                        text-[11px]
                        font-medium
                        text-zinc-400
                        transition-colors
                        duration-200
                        group-hover:text-white
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
                          shadow-lg
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