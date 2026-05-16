interface AjeLogoProps {
  size?: number;
  className?: string;
}

export default function AjeLogo({ size = 32, className = "" }: AjeLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      width={size}
      height={size}
      className={className}
    >
      <rect width="64" height="64" rx="14" fill="transparent" />

      {/* Leaf fill */}
      <path
        d="M34 52 C34 52 14 46 12 26 C12 26 28 10 48 14 C48 14 52 34 34 52 Z"
        fill="#00cc73"
        opacity={0.15}
      />
      {/* Leaf outline */}
      <path
        d="M34 52 C34 52 14 46 12 26 C12 26 28 10 48 14 C48 14 52 34 34 52 Z"
        stroke="#00cc73"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Center vein */}
      <line x1="34" y1="52" x2="30" y2="18" stroke="#00cc73" strokeWidth="1.5" strokeLinecap="round" opacity={0.7} />
      {/* Side veins */}
      <line x1="27" y1="38" x2="38" y2="32" stroke="#00cc73" strokeWidth="1" strokeLinecap="round" opacity={0.5} />
      <line x1="24" y1="30" x2="38" y2="24" stroke="#00cc73" strokeWidth="1" strokeLinecap="round" opacity={0.5} />
    </svg>
  );
}
