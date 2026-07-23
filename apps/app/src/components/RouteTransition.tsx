import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

/** Re-mounts children on navigation so the enter animation replays. */
export const RouteTransition = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  return (
    <div key={location.pathname} className="ap-route-enter">
      {children}
    </div>
  );
};
