import { cn } from "@/lib/utils";

/**
 * AIWholesail brand wordmark. Renders the AIWHOLES[sail]IL lockup as inline
 * SVG so it stays crisp at any size and respects currentColor.
 *
 * Source of truth: marketing/creatives/branding/aiwholesail-logo-main.html
 */

type Variant = "dark" | "light" | "onCyan";

const VARIANTS: Record<Variant, { text: string; sail: string }> = {
  dark: { text: "#ffffff", sail: "#00c4c8" },
  light: { text: "#0a0a0a", sail: "#00c4c8" },
  onCyan: { text: "#0a0a0a", sail: "#ffffff" },
};

const SAIL_PATH =
  "M28,4 C33,6 42,30 47,62 Q48,68 42,68 L8,68 Q2,68 3,62 C8,30 23,2 28,4 Z";

interface AIWholesailLogoProps {
  variant?: Variant;
  className?: string;
  title?: string;
}

export function AIWholesailLogo({
  variant = "dark",
  className,
  title = "AIWholesail",
}: AIWholesailLogoProps) {
  const palette = VARIANTS[variant];

  return (
    <span
      role="img"
      aria-label={title}
      className={cn(
        "aiwholesail-wordmark inline-flex items-baseline whitespace-nowrap leading-none",
        className,
      )}
      style={{ color: palette.text }}
    >
      AIWHOLES
      <svg
        viewBox="0 0 50 70"
        aria-hidden="true"
        focusable="false"
        style={{
          height: "0.78em",
          width: "auto",
          margin: "0 -0.03em",
          transform: "translateY(0.06em)",
          flexShrink: 0,
        }}
      >
        <path fill={palette.sail} d={SAIL_PATH} />
      </svg>
      IL
    </span>
  );
}

export default AIWholesailLogo;
