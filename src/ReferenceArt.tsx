const illustrations = {
  sprout: "sprout", welcome: "puppy-welcome", reading: "puppy-reading",
  thinking: "puppy-thinking", resting: "puppy-resting", cheering: "puppy-cheering",
  journaling: "puppy-journaling", landscape: "landscape", books: "books-tea",
} as const;

/** Independent transparent illustrations, never a crop from the reference boards. */
export function ReferenceArt({ kind, className = "", alt = "", eager = false, size }: {
  kind: keyof typeof illustrations; className?: string; alt?: string; eager?: boolean; size?: 'tiny'|'thumbnail';
}) {
  const base=`/assets/companions-web/${illustrations[kind]}`;
  const sizes=size==='tiny'?'40px':size==='thumbnail'?'64px':kind==='welcome'?'(min-width: 700px) 300px, 172px':kind==='books'?'(min-width: 700px) 270px, 142px':kind==='landscape'?'(min-width: 700px) 460px, 280px':kind==='reading'||kind==='resting'?'(min-width: 700px) 250px, 180px':'100px';
  return <img className={`reference-art reference-${kind} ${className}`}
    src={`${base}-small.webp`} srcSet={`${base}-tiny.webp 128w, ${base}-small.webp 320w, ${base}-large.webp 480w`} sizes={sizes} alt={alt}
    aria-hidden={alt ? undefined : true} draggable={false} decoding="async"
    fetchPriority={kind==='welcome'&&eager?'high':'auto'} loading={eager ? "eager" : "lazy"} />;
}
