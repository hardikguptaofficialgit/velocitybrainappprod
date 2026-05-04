import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from '../Icons';

export default function Dialog({
  isOpen,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  maxWidth = 'max-w-3xl',
  contentClassName = '',
  bodyClassName = '',
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-5">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative z-10 w-full ${maxWidth} max-h-[calc(100vh-2rem)] overflow-hidden rounded-[28px] border border-[#2a2a2a] bg-[#0b0b0b] outline-none ${contentClassName}`}
        style={{ boxShadow: '12px 12px 0 rgba(0,0,0,0.38)' }}
      >
        <div className="flex max-h-[calc(100vh-2rem)] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-[#1b1b1b] px-5 py-5 md:px-8 md:py-6">
            <div className="min-w-0">
              {eyebrow && (
                <p className="mono mb-3 text-[11px] uppercase tracking-[0.28em] text-[#EA803A]">
                  {eyebrow}
                </p>
              )}
              <h3 className="syne text-2xl font-extrabold leading-tight text-white md:text-4xl">
                {title}
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="group flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#121212] text-zinc-400 transition-all duration-200 hover:border-[#3a3a3a] hover:text-white"
              aria-label="Close dialog"
            >
              <span className="transition-transform duration-300 ease-out group-hover:rotate-180">
                <X size={18} weight="duotone" color="currentColor" />
              </span>
            </button>
          </div>

          <div className={`overflow-y-auto px-5 py-5 md:px-8 md:py-6 ${bodyClassName}`}>
            {children}
          </div>

          {footer && (
            <div className="border-t border-[#1b1b1b] px-5 py-4 md:px-8 md:py-5">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
