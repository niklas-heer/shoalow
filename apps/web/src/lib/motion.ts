const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A transition duration that drops to zero when the device asks for reduced motion. */
export const motion = (ms: number): number => (reduced ? 0 : ms);
