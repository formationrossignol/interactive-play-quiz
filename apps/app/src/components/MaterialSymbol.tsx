import type { CSSProperties, HTMLAttributes } from "react";
import { LetsIcon } from "@/components/LetsIcon";

type MaterialSymbolSize = 18 | 20 | 24 | 32 | 40 | 48;

interface MaterialSymbolProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  name: string;
  size?: MaterialSymbolSize | number;
  filled?: boolean;
  label?: string;
}

/**
 * Self-hosted Material Symbol.
 *
 * Decorative by default. Pass `label` only when the symbol itself carries
 * meaning and is not already named by adjacent text or its parent control.
 */
export const MaterialSymbol = ({
  name,
  size = 24,
  filled = false,
  label,
  className = "",
  style,
  ...props
}: MaterialSymbolProps) => {
  const symbolStyle = {
    "--md-symbol-size": `${size}px`,
    ...style,
  } as CSSProperties;

  return (
    <LetsIcon
      {...props}
      name={name}
      size={size}
      label={label}
      className={`material-symbol${filled ? " material-symbol--filled" : ""}${className ? ` ${className}` : ""}`}
      style={symbolStyle}
    />
  );
};
