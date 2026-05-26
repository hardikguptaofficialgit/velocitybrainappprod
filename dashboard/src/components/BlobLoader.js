import React from 'react';

/**
 * @param {'default' | 'accent'} variant
 * - default: dark canvas (full-page loaders)
 * - accent: transparent, tuned for orange CTA buttons (#EA803A)
 */
const BlobLoader = ({
  size = 72,
  className = '',
  label = 'LOADING...',
  variant = 'default'
}) => {
  const isAccent = variant === 'accent';
  const isCompact = isAccent || !label;

  const rootClass = [
    'flex items-center justify-center',
    isCompact ? '' : 'flex-col gap-3',
    isAccent ? 'bg-transparent' : 'bg-black',
    className
  ].filter(Boolean).join(' ');

  const frameClass = isAccent
    ? 'flex items-center justify-center overflow-hidden bg-transparent'
    : 'flex items-center justify-center overflow-hidden rounded-none bg-black border-0 outline-none shadow-none';

  const imageStyle = isAccent
    ? {
        width: size,
        height: size,
        background: 'transparent',
        mixBlendMode: 'darken'
      }
    : {
        width: size,
        height: size,
        background: '#000',
        mixBlendMode: 'screen'
      };

  return (
    <div className={rootClass} aria-hidden={!label}>
      <div className={frameClass} style={{ width: size, height: size }}>
        <img
          src="/loader-clean.gif"
          alt={label || 'Loading'}
          width={size}
          height={size}
          loading="eager"
          draggable={false}
          className={`block select-none object-contain border-0 outline-none shadow-none ${isAccent ? 'bg-transparent' : 'bg-black'}`}
          style={imageStyle}
        />
      </div>

      {label ? (
        <p
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: isAccent ? '#1a1a1a' : '#FF7A00',
            opacity: 0.82,
            margin: 0,
            textTransform: 'uppercase'
          }}
        >
          {label}
        </p>
      ) : null}
    </div>
  );
};

export default BlobLoader;
