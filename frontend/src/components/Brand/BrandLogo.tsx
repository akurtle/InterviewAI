import { Link } from "react-router-dom";

type WaveIconProps = {
  className?: string;
};

export function WaveIcon({ className = "h-5 w-5" }: WaveIconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2 12 Q4 6 6 12 Q8 18 10 12 Q12 6 14 12 Q16 18 18 12 Q20 6 22 12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={2}
      />
    </svg>
  );
}

type BrandLogoProps = {
  compact?: boolean;
  to?: string;
};

function BrandLogo({ compact = false, to = "/" }: BrandLogoProps) {
  return (
    <Link to={to} className="flex min-w-0 items-center gap-3">
      <span className="theme-logo flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]">
        <WaveIcon />
      </span>
      {!compact && (
        <span className="theme-text-primary truncate text-[17px] font-semibold">
          TalkItOut<span className="theme-accent-text">AI</span>
        </span>
      )}
    </Link>
  );
}

export default BrandLogo;
