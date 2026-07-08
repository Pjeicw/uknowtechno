interface LogoProps {
  size?: number;
  className?: string;
  rounded?: boolean;
}

/**
 * UknowTechno brand mark — square emblem combining sacred/math geometry
 * (golden-ratio spiral, grid lines, constellation points) with a galaxy
 * backdrop and a bold central "U". Source asset: /favicon.svg (also used
 * as the browser tab favicon — one source of truth for the brand mark).
 */
export default function Logo({ size = 44, className = '', rounded = true }: LogoProps) {
  return (
    <img
      src="/favicon.svg"
      alt="UknowTechno logo"
      width={size}
      height={size}
      className={`uk-logo ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: rounded ? '22%' : 0,
        objectFit: 'cover',
        boxShadow: '0 0 16px rgba(100, 255, 218, 0.35)',
        flexShrink: 0,
      }}
    />
  );
}
