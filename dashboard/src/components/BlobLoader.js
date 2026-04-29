import React, { useMemo } from 'react';

const SmoothLoader = ({ size = 120, className = '', label = 'LOADING...' }) => {
  // Generated a smoother, less curly path
  const pathData = useMemo(() => {
    const cx = 60;
    const cy = 60;
    const radius = 45;
    const amplitude = 3.5; // Slightly shallower waves
    const frequency = 8;   // Reduced from 16 to 8 for a "less curly" look
    const steps = 120;
    
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const r = radius + amplitude * Math.sin(angle * frequency);
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
    }
    points.push('Z');
    return points.join(' ');
  }, []);

  return (
    <div className={`flex flex-col items-center justify-center gap-5 ${className}`}>
      <svg
        className="animate-spin"
        width={size}
        height={size}
        viewBox="0 0 120 120"
        aria-hidden="true"
        // Sped up the rotation just a tiny bit for a sleeker feel
        style={{ animationDuration: '3s', animationTimingFunction: 'linear' }} 
      >
        <path
          d={pathData}
          fill="none"
          stroke="#FF7A00"
          strokeWidth="5" // Thicker stroke for a bolder, cleaner design
          strokeLinecap="round"
          strokeLinejoin="round"
          // Glow effect (drop-shadow) has been completely removed
        />
      </svg>
      {label ? (
        <p 
          className="text-xs text-center font-semibold tracking-widest" 
          style={{ 
            fontFamily: 'JetBrains Mono, monospace',
            color: '#FF7A00',
            opacity: 0.9 // Slight transparency for a more refined look
          }}
        >
          {label}
        </p>
      ) : null}
    </div>
  );
};

export default SmoothLoader;