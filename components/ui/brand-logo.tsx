import { cn } from "@/lib/utils";

type BrandLogoSize = "sm" | "md" | "lg";

type BrandLogoProps = {
  size?: BrandLogoSize;
  showWordmark?: boolean;
  className?: string;
};

const SIZES: Record<
  BrandLogoSize,
  { box: number; radius: number; mark: number; wordmark: number; gap: number }
> = {
  sm: { box: 32, radius: 9, mark: 13, wordmark: 15, gap: 10 },
  md: { box: 44, radius: 12, mark: 16, wordmark: 19, gap: 12 },
  lg: { box: 56, radius: 16, mark: 20, wordmark: 24, gap: 14 },
};

export function BrandLogo({
  size = "md",
  showWordmark = true,
  className,
}: BrandLogoProps) {
  const s = SIZES[size];

  return (
    <span
      className={cn("brand-logo", className)}
      style={{ gap: `${s.gap}px` }}
    >
      <span
        className="brand-logo-mark"
        style={{
          width: `${s.box}px`,
          height: `${s.box}px`,
          borderRadius: `${s.radius}px`,
          fontSize: `${s.mark}px`,
        }}
        aria-hidden="true"
      >
        <span className="brand-logo-mark-text">PF</span>
      </span>

      {showWordmark && (
        <span
          className="brand-logo-wordmark"
          style={{ fontSize: `${s.wordmark}px` }}
        >
          <span className="brand-logo-wordmark-soft">Postman</span>
          <span className="brand-logo-wordmark-accent">Fox</span>
        </span>
      )}

      <style>{`
        .brand-logo {
          display: inline-flex;
          align-items: center;
          line-height: 1;
        }

        .brand-logo-mark {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: oklch(99% 0.01 65);
          font-family: var(--font-display, ui-sans-serif, system-ui);
          font-weight: 700;
          letter-spacing: -0.06em;
          background:
            radial-gradient(120% 90% at 25% 15%, oklch(100% 0 0 / 0.32), transparent 55%),
            linear-gradient(
              135deg,
              oklch(64% 0.16 55) 0%,
              oklch(54% 0.15 42) 48%,
              oklch(46% 0.14 32) 100%
            );
          box-shadow:
            0 1px 0 oklch(100% 0 0 / 0.22) inset,
            0 -1px 0 oklch(20% 0.04 30 / 0.2) inset,
            0 6px 18px oklch(52% 0.14 42 / 0.32),
            0 1px 3px oklch(30% 0.05 35 / 0.18);
          transition: box-shadow 0.25s ease, transform 0.25s ease;
        }

        .brand-logo-mark::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(
            180deg,
            oklch(100% 0 0 / 0.18),
            transparent 45%
          );
          pointer-events: none;
        }

        .brand-logo-mark-text {
          position: relative;
          z-index: 1;
          text-shadow: 0 1px 0 oklch(30% 0.05 35 / 0.25);
        }

        .brand-logo:hover .brand-logo-mark,
        a:hover .brand-logo-mark {
          box-shadow:
            0 1px 0 oklch(100% 0 0 / 0.28) inset,
            0 -1px 0 oklch(20% 0.04 30 / 0.22) inset,
            0 10px 24px oklch(52% 0.14 42 / 0.42),
            0 2px 6px oklch(30% 0.05 35 / 0.22);
          transform: translateY(-1px);
        }

        .brand-logo-wordmark {
          font-family: var(--font-display, ui-sans-serif, system-ui);
          font-weight: 600;
          letter-spacing: -0.025em;
          white-space: nowrap;
        }

        .brand-logo-wordmark-soft {
          color: var(--color-text-secondary, var(--color-text));
          font-weight: 500;
        }

        .brand-logo-wordmark-accent {
          color: var(--color-accent);
          font-weight: 700;
          background: linear-gradient(
            135deg,
            oklch(60% 0.16 50),
            oklch(48% 0.15 35)
          );
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        @media (prefers-reduced-motion: reduce) {
          .brand-logo-mark {
            transition: none;
          }
          .brand-logo:hover .brand-logo-mark,
          a:hover .brand-logo-mark {
            transform: none;
          }
        }
      `}</style>
    </span>
  );
}
