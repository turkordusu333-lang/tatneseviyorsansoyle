import React, { useState, useRef } from 'react';

interface HoloProps {
  children: React.ReactNode;
  rarity: 'EFSANEVİ' | 'EPİK' | 'ENDER' | 'SIRADAN';
  className?: string;
  style?: React.CSSProperties;
}

const HoloComponent: React.FC<HoloProps> = ({ children, rarity, className = '', style = {} }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const rafRef = useRef<number | null>(null);

  const updateCoords = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    rafRef.current = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
      setCoords({ x, y });
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only on desktop fine pointer
    if (window.matchMedia('(pointer: fine)').matches) {
      updateCoords(e.clientX, e.clientY);
    }
  };

  const isPremium = rarity !== 'SIRADAN';

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => {
        if (window.matchMedia('(pointer: fine)').matches) {
          setIsHovered(true);
        }
      }}
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

export const Holo = React.memo(HoloComponent);
