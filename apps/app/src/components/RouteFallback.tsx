/** Shown while a lazy route chunk loads — replaces the blank flash. */
export const RouteFallback = () => (
  <div
    style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}
    role="status"
    aria-label="Loading"
  >
    <div className="ap-route-loader">
      <span /><span /><span />
    </div>
  </div>
);
