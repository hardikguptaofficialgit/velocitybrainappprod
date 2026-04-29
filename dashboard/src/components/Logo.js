import React from 'react';

const Logo = ({ className = "", size = 40 }) => {
  return (
    <img
      src="/logo.png"
      alt="VelocityBrain Logo"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
};

export default Logo;
