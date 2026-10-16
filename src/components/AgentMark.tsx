// AgentMark — the product's mark: the glass agent, a box you can see the computation inside.
//
// This is NOT an edit of VerticeMark. That one is pure SVG geometry — the company's vertex glyph,
// four faces to a centre apex — and this is a 3D render, so it cannot be expressed as paths.
// Kept as a separate component so the company's mark still exists for company surfaces instead of
// being overwritten by the product's.
//
// `spin` is accepted and deliberately IGNORED. VerticeMark could rotate because flat geometry reads
// the same from any angle; this render has baked lighting and specular highlights, so spinning it
// in 2D looks like a broken sprite rather than a turning object. The prop stays in the signature so
// existing call sites keep compiling and the intent is visible rather than silently dropped.
//
// Served as WebP: 28 KB against 129 KB for the equivalent PNG, and this loads on every page.

type Props = {
  size?: number;
  className?: string;
  /** Accepted for call-site compatibility with VerticeMark. Has no effect — see above. */
  spin?: boolean;
};

export function AgentMark({ size = 26, className = "" }: Props) {
  return (
    <img
      src="/mark.webp"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      decoding="async"
      className={className}
      // Explicit width/height in style as well as attributes: the attributes reserve layout space
      // before the image loads (no shift), the style holds the box if a parent sets img{width:100%}.
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}
