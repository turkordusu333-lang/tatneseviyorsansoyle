import React, { useState, useRef } from 'react';

interface HoloProps {
  children: React.ReactNode;
  rarity: 'EFSANEVİ' | 'EPİK' | 'ENDER' | 'SIRADAN';
  className?: string;
  style?: React.CSSProperties;
}

export const Holo: React.FC<HoloProps> = ({ children, rarity, className = '', style = {} }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCoords({ x, y });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    setCoords({ x, y });
  };

  const isPremium = rarity !== 'SIRADAN';

  return (
    <div
      id={`holo-wrapper-${Math.random().toString(36).substr(2, 9)}`}
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setCoords({ x: 50, y: 50 });
      }}
      className={`relative overflow-hidden ${className}`}
      style={{
        ...style,
        '--holo-x': `${coords.x}%`,
        '--holo-y': `${coords.y}%`,
        '--holo-opacity': isHovered ? (rarity === 'EFSANEVİ' ? '0.75' : '0.6') : '0.25',
      } as React.CSSProperties}
    >
      {children}
      
      {/* Dynamic CSS reflection layer using CSS variables */}
      {isPremium && (
        <>
          <div 
            id={`holo-dodge-${Math.random().toString(36).substr(2, 9)}`}
            className="pointer-events-none absolute inset-0 z-30 mix-blend-color-dodge transition-opacity duration-300"
            style={{
              opacity: 'var(--holo-opacity)',
              background: rarity === 'EFSANEVİ'
                ? 'radial-gradient(circle at var(--holo-x) var(--holo-y), rgba(255, 215, 0, 0.45) 0%, rgba(139, 92, 246, 0.35) 30%, rgba(236, 72, 153, 0.2) 60%, transparent 80%)'
                : rarity === 'EPİK'
                ? 'radial-gradient(circle at var(--holo-x) var(--holo-y), rgba(236, 72, 153, 0.45) 0%, rgba(59, 130, 246, 0.35) 40%, rgba(139, 92, 246, 0.15) 70%, transparent 90%)'
                : 'radial-gradient(circle at var(--holo-x) var(--holo-y), rgba(52, 211, 153, 0.45) 0%, rgba(6, 182, 212, 0.35) 40%, transparent 80%)',
            }}
          />
          <div 
            id={`holo-overlay-${Math.random().toString(36).substr(2, 9)}`}
            className="pointer-events-none absolute inset-0 z-30 mix-blend-overlay transition-opacity duration-300"
            style={{
              opacity: 'var(--holo-opacity)',
              background: `linear-gradient(calc(135deg + (var(--holo-x) - 50%) * 0.5), transparent 40%, rgba(255, 255, 255, 0.3) 48%, rgba(255, 255, 255, 0.5) 50%, rgba(255, 255, 255, 0.3) 52%, transparent 60%)`,
            }}
          />
        </>
      )}
    </div>
  );
};
