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
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {label}
        </span>
      ) : null}

      <MinimalSelect
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          [&_button]:flex
          [&_button]:h-10
          [&_button]:w-full
          [&_button]:items-center
          [&_button]:justify-between
          [&_button]:rounded-xl
          [&_button]:border
          [&_button]:px-3
          [&_button]:text-sm
          [&_button]:transition-colors
          [&_button]:outline-none

          [&_button]:bg-white
          [&_button]:text-zinc-900
          [&_button]:border-zinc-200

          dark:[&_button]:bg-zinc-950
          dark:[&_button]:text-zinc-100
          dark:[&_button]:border-zinc-800

          hover:[&_button]:border-zinc-300
          dark:hover:[&_button]:border-zinc-700

          [&_button]:focus-visible:ring-2
          [&_button]:focus-visible:ring-zinc-300
          dark:[&_button]:focus-visible:ring-zinc-700

          ${error ? '[&_button]:border-red-500 dark:[&_button]:border-red-500' : ''}
          ${disabled ? '[&_button]:cursor-not-allowed [&_button]:opacity-50' : ''}

          ${selectClassName}
        `}
        buttonClassName={buttonClassName}
        menuClassName={`
          mt-1
          rounded-xl
          border
          bg-white
          p-1
          shadow-lg
          border-zinc-200

          dark:bg-zinc-950
          dark:border-zinc-800

          ${menuClassName}
        `}
        optionClassName={`
          rounded-lg
          px-3
          py-2
          text-sm
          text-zinc-700
          transition-colors
          hover:bg-zinc-100
          hover:text-zinc-900

          dark:text-zinc-200
          dark:hover:bg-zinc-900
          dark:hover:text-white

          ${optionClassName}
        `}
      />

      {helperText ? (
        <p
          className={`text-xs ${
            error
              ? 'text-red-500 dark:text-red-400'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          {helperText}
        </p>
      ) : null}
    </label>
  );
}