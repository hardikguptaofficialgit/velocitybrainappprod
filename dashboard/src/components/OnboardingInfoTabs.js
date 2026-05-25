import React from 'react';

const VelAiMark = ({ size = 18 }) => (
  <img
    src="/logo.png"
    alt=""
    width={size}
    height={size}
    className="rounded object-contain"
    aria-hidden
  />
);

export function OnboardingInfoTabBar({ activeMode, onModeChange, velaiMode, manualMode }) {
  const tabClass = (selected) =>
    `flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-2.5 text-[12px] font-semibold ${
      selected ? 'border-[#EA803A] text-white' : 'border-transparent text-zinc-500'
    }`;

  return (
    <div className="flex border-b border-zinc-800" role="tablist" aria-label="Setup method">
      <button
        type="button"
        role="tab"
        aria-selected={activeMode === velaiMode}
        onClick={() => onModeChange(velaiMode)}
        className={tabClass(activeMode === velaiMode)}
      >
        <VelAiMark />
        VelAI
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeMode === manualMode}
        onClick={() => onModeChange(manualMode)}
        className={tabClass(activeMode === manualMode)}
      >
        <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Manual
      </button>
    </div>
  );
}
