export function ClaudeMascot({ size = 56 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="claude-mascot mascot-blink"
      aria-label="Claude"
    >
      <g fill="hsl(24 75% 60%)">
        <rect x="3" y="3" width="10" height="9" />
        <rect x="2" y="4" width="1" height="7" />
        <rect x="13" y="4" width="1" height="7" />
        <rect x="4" y="2" width="8" height="1" />
        <rect x="3" y="12" width="2" height="1" />
        <rect x="11" y="12" width="2" height="1" />
      </g>
      <g fill="hsl(24 8% 7%)">
        <rect x="5" y="6" width="2" height="2" />
        <rect x="9" y="6" width="2" height="2" />
        <rect x="6" y="9" width="4" height="1" />
      </g>
      <g fill="hsl(24 75% 50%)">
        <rect x="3" y="11" width="1" height="1" />
        <rect x="12" y="11" width="1" height="1" />
      </g>
    </svg>
  );
}
