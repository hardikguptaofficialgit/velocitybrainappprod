import React from 'react';

const BlobLoader = ({ size = 72, className = '', label = 'LOADING...' }) => (
  <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
    <img
      src="/loader-clean.gif"
      alt={label || 'Loading'}
      width={size}
      height={size}
      loading="eager"
      draggable={false}
      className="block select-none object-contain"
      style={{
        width: size,
        height: size,
      }}
    />

    {label ? (
      <p
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.18em',
          color: '#FF7A00',
          opacity: 0.8,
          margin: 0,
        }}
      >
        {label}
      </p>
    ) : null}
  </div>
);

export default BlobLoader;
