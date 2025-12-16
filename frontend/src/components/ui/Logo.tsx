import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  variant?: 'full' | 'icon';
}

const sizes = {
  sm: { icon: 32, text: 'text-lg' },
  md: { icon: 40, text: 'text-xl' },
  lg: { icon: 48, text: 'text-2xl' },
  xl: { icon: 64, text: 'text-3xl' },
};

/**
 * Dillanci Logo - Celtic/Hausa knot pattern
 * Inspired by traditional interlocking geometric designs
 */
export function Logo({
  size = 'md',
  showText = true,
  className,
  variant = 'full'
}: LogoProps) {
  const { icon: iconSize, text: textSize } = sizes[size];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Knot Icon */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        <defs>
          <linearGradient id="dillanciGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B4513" />
            <stop offset="50%" stopColor="#B8860B" />
            <stop offset="100%" stopColor="#8B4513" />
          </linearGradient>
        </defs>

        <g transform="translate(50, 50)" stroke="url(#dillanciGradient)" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* Top pointed loop */}
          <path d="M0,-42 C-12,-42 -18,-36 -18,-24 C-18,-12 -8,-6 0,-6 C8,-6 18,-12 18,-24 C18,-36 12,-42 0,-42" />

          {/* Bottom pointed loop */}
          <path d="M0,42 C-12,42 -18,36 -18,24 C-18,12 -8,6 0,6 C8,6 18,12 18,24 C18,36 12,42 0,42" />

          {/* Left pointed loop */}
          <path d="M-42,0 C-42,-12 -36,-18 -24,-18 C-12,-18 -6,-8 -6,0 C-6,8 -12,18 -24,18 C-36,18 -42,12 -42,0" />

          {/* Right pointed loop */}
          <path d="M42,0 C42,-12 36,-18 24,-18 C12,-18 6,-8 6,0 C6,8 12,18 24,18 C36,18 42,12 42,0" />

          {/* Inner diamond grid - diagonal lines */}
          <path d="M-28,-28 L28,28" />
          <path d="M28,-28 L-28,28" />
          <path d="M-20,-28 L28,20" />
          <path d="M-28,-20 L20,28" />
          <path d="M20,-28 L-28,20" />
          <path d="M28,-20 L-20,28" />

          {/* Curved connections at corners */}
          <path d="M-28,-20 Q-28,-28 -20,-28" />
          <path d="M20,-28 Q28,-28 28,-20" />
          <path d="M28,20 Q28,28 20,28" />
          <path d="M-20,28 Q-28,28 -28,20" />
        </g>
      </svg>

      {/* Text */}
      {showText && variant === 'full' && (
        <span className={cn(
          'font-bold tracking-tight',
          'bg-gradient-to-r from-primary-700 via-primary-500 to-primary-700 bg-clip-text text-transparent',
          textSize
        )}>
          Dillanci
        </span>
      )}
    </div>
  );
}

/**
 * Simplified icon-only logo for favicons, small spaces
 */
export function LogoIcon({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="dillanciIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B4513" />
          <stop offset="50%" stopColor="#B8860B" />
          <stop offset="100%" stopColor="#8B4513" />
        </linearGradient>
      </defs>

      <g transform="translate(50, 50)" stroke="url(#dillanciIconGradient)" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Simplified knot pattern */}
        <path d="M0,-40 C-15,-40 -20,-30 -20,-20 C-20,-10 -10,-5 0,-5 C10,-5 20,-10 20,-20 C20,-30 15,-40 0,-40" />
        <path d="M0,40 C-15,40 -20,30 -20,20 C-20,10 -10,5 0,5 C10,5 20,10 20,20 C20,30 15,40 0,40" />
        <path d="M-40,0 C-40,-15 -30,-20 -20,-20 C-10,-20 -5,-10 -5,0 C-5,10 -10,20 -20,20 C-30,20 -40,15 -40,0" />
        <path d="M40,0 C40,-15 30,-20 20,-20 C10,-20 5,-10 5,0 C5,10 10,20 20,20 C30,20 40,15 40,0" />

        {/* Center cross pattern */}
        <path d="M-25,-25 L25,25" />
        <path d="M25,-25 L-25,25" />
      </g>
    </svg>
  );
}

export default Logo;
