import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  variant?: 'full' | 'icon';
}

const sizes = {
  sm: { icon: 32, full: 32 },
  md: { icon: 40, full: 40 },
  lg: { icon: 48, full: 48 },
  xl: { icon: 64, full: 64 },
};

/**
 * Dillanci Logo - Celtic/Hausa knot pattern
 * Uses actual brand assets from /images folder
 */
export function Logo({
  size = 'md',
  className,
  variant = 'full'
}: LogoProps) {
  const { icon: iconSize, full: fullSize } = sizes[size];

  if (variant === 'icon') {
    return (
      <img
        src="/images/icon.svg"
        alt="Dillanci"
        width={iconSize}
        height={iconSize}
        className={cn('flex-shrink-0', className)}
      />
    );
  }

  return (
    <img
      src="/images/logo-full.svg"
      alt="Dillanci"
      height={fullSize}
      className={cn('flex-shrink-0 w-auto', className)}
      style={{ height: fullSize }}
    />
  );
}

/**
 * Simplified icon-only logo for favicons, small spaces
 */
export function LogoIcon({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/images/icon.svg"
      alt="Dillanci"
      width={size}
      height={size}
      className={className}
    />
  );
}

export default Logo;
