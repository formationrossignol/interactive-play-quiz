import type { LucideIcon } from "lucide-react";

interface ToolHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** CSS color value (e.g. "var(--ap-quiz)") — tints the icon tile. */
  accent: string;
}

// Every standalone tool page opens with one of these — a big Lucide icon
// standing in for a hero illustration (no image-asset pipeline in this app,
// and the app is standardizing on Lucide for every icon anyway).
export const ToolHeader = ({ icon: Icon, title, description, accent }: ToolHeaderProps) => (
  <div
    className="ap-card"
    style={{
      display: "flex",
      alignItems: "center",
      gap: 20,
      padding: "24px",
      marginBottom: 32,
      background: "var(--ap-card)",
    }}
  >
    <div
      style={{
        width: 72,
        height: 72,
        flexShrink: 0,
        borderRadius: "var(--ap-r-lg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: accent,
        border: "1px solid color-mix(in srgb, var(--ap-line) 70%, transparent)",
        boxShadow: "none",
      }}
    >
      <Icon style={{ width: 36, height: 36, color: "#fff" }} strokeWidth={2} />
    </div>
    <div>
      <h1 className="ap-h2" style={{ fontSize: "24px", marginBottom: "4px" }}>{title}</h1>
      <p className="ap-muted" style={{ fontSize: "14px", margin: 0 }}>{description}</p>
    </div>
  </div>
);
