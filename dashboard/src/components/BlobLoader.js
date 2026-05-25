import React from 'react';

const BlobLoader = ({
  size = 72,
  className = '',
  label = 'LOADING...'
}) => (
  <div
    className={`
      flex
      flex-col
      items-center
      justify-center
      gap-3
      bg-black
      ${className}
    `}
  >
    <div
      className="
        flex
        items-center
        justify-center
        overflow-hidden
        rounded-none
        bg-black
        shadow-none
        border-0
        outline-none
      "
      style={{
        width: size,
        height: size,
      }}
    >
      <img
        src="/loader-clean.gif"
        alt={label || 'Loading'}
        width={size}
        height={size}
        loading="eager"
        draggable={false}
        className="
          block
          select-none
          object-contain
          bg-black
          border-0
          outline-none
          shadow-none
        "
        style={{
          width: size,
          height: size,
          background: '#000',
          mixBlendMode: 'screen',
        }}
      />
    </div>

    {label ? (
      <p
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.18em',
          color: '#FF7A00',
          opacity: 0.82,
          margin: 0,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </p>
    ) : null}
  </div>
);

export default BlobLoader;