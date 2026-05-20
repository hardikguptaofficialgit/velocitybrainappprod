import React from 'react';
import MinimalSelect from '../MinimalSelect';

export default function DropdownField({
  label,
  helperText,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  error = false,
  disabled = false,
  className = '',
  selectClassName = '',
  buttonClassName = '',
  menuClassName = '',
  optionClassName = ''
}) {
  return (
    <label className={`flex w-full flex-col gap-2 ${className}`}>
      {label ? (
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {label}
          </span>
        </div>
      ) : null}

      <MinimalSelect
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          [&_button]:group
          [&_button]:relative
          [&_button]:flex
          [&_button]:h-11
          [&_button]:w-full
          [&_button]:items-center
          [&_button]:justify-between
          [&_button]:rounded-2xl
          [&_button]:border
          [&_button]:px-4
          [&_button]:text-sm
          [&_button]:font-medium
          [&_button]:transition-all
          [&_button]:duration-200
          [&_button]:outline-none

          dark:[&_button]:bg-[#181a19]
          dark:[&_button]:border-[#2b2f2d]
          dark:[&_button]:text-zinc-100

          [&_button]:bg-white
          [&_button]:border-[#e7e7e3]
          [&_button]:text-zinc-800

          [&_button]:shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.04)]

          hover:[&_button]:border-[#d4d4cf]
          dark:hover:[&_button]:border-[#3a3f3c]

          [&_button]:focus-visible:ring-2
          [&_button]:focus-visible:ring-[#dcefd8]
          dark:[&_button]:focus-visible:ring-[#2f4d39]

          ${error
            ? `
              [&_button]:border-red-300
              dark:[&_button]:border-red-500/40
            `
            : ''
          }

          ${disabled
            ? `
              [&_button]:cursor-not-allowed
              [&_button]:opacity-60
            `
            : ''
          }

          ${selectClassName}
        `}
        buttonClassName={`
          backdrop-blur-0
          ${buttonClassName}
        `}
        menuClassName={`
          mt-2
          overflow-hidden
          rounded-2xl
          border
          p-1.5
          shadow-[0_10px_40px_rgba(0,0,0,0.08)]

          bg-white
          border-[#ecece7]

          dark:bg-[#1b1d1c]
          dark:border-[#2d312f]

          ${menuClassName}
        `}
        optionClassName={`
          flex
          cursor-pointer
          items-center
          rounded-xl
          px-3
          py-2.5
          text-sm
          font-medium
          transition-all
          duration-150

          text-zinc-700
          hover:bg-[#f4f7f1]
          hover:text-zinc-900

          dark:text-zinc-200
          dark:hover:bg-[#252927]
          dark:hover:text-white

          ${optionClassName}
        `}
      />

      {helperText ? (
        <p
          className={`
            px-1 text-xs leading-relaxed
            ${error
              ? 'text-red-500 dark:text-red-400'
              : 'text-zinc-500 dark:text-zinc-400'
            }
          `}
        >
          {helperText}
        </p>
      ) : null}
    </label>
  );
}