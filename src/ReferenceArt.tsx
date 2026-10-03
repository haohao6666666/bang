const illustrations = {
  sprout: "sprout", welcome: "puppy-welcome", reading: "puppy-reading",
  thinking: "puppy-thinking", resting: "puppy-resting", cheering: "puppy-cheering",
  journaling: "puppy-journaling", landscape: "landscape", books: "books-tea",
} as const;

/** Independent transparent illustrations, never a crop from the reference boards. */
export function ReferenceArt({ kind, className = "", alt = "", eager = false }: {
  kind: keyof typeof illustrations; className?: string; alt?: string; eager?: boolean;
}) {
  return <img className={`reference-art reference-${kind} ${className}`}
    src={`/assets/companions-v3/${illustrations[kind]}.webp`} alt={alt}
    aria-hidden={alt ? undefined : true} draggable={false} decoding="async"
    loading={eager ? "eager" : "lazy"} />;
}
