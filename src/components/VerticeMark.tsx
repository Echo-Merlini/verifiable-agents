type VerticeMarkProps = {
  size?: number;
  spin?: boolean;
  className?: string;
};

/**
 * The Vértice mark — a pyramid seen from above. A square base with edges
 * converging on the central apex; light falls from the upper-left across four
 * graded faces, and the apex catches the brass.
 */
export function VerticeMark({ size = 96, spin = false, className = "" }: VerticeMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      // viewBox is padded beyond the 10–90 base so the corners don't clip the
      // frame as the mark rotates (corner radius ≈ 56.6 from centre).
      viewBox="-16 -16 132 132"
      className={className}
      aria-hidden="true"
      role="img"
    >
      <g className={spin ? "vertice-spin" : ""}>
        {/* four faces, light from the upper-left */}
        <polygon points="10,10 90,10 50,50" fill="#3A3E48" />
        <polygon points="10,10 10,90 50,50" fill="#2C2F37" />
        <polygon points="90,10 90,90 50,50" fill="#22242B" />
        <polygon points="10,90 90,90 50,50" fill="#191B21" />

        {/* ridge lines from each base corner to the apex */}
        <g stroke="rgba(246,246,248,0.10)" strokeWidth="0.75">
          <line x1="10" y1="10" x2="50" y2="50" />
          <line x1="90" y1="10" x2="50" y2="50" />
          <line x1="90" y1="90" x2="50" y2="50" />
          <line x1="10" y1="90" x2="50" y2="50" />
        </g>

        {/* the lit ridge + apex highlight in brass */}
        <line
          x1="10"
          y1="10"
          x2="50"
          y2="50"
          stroke="#E0A24C"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.9"
        />
        <circle cx="50" cy="50" r="2.6" fill="#E0A24C" />
      </g>
    </svg>
  );
}
