import type { Attachment } from "svelte/attachments";

/**
 * Reports when a mouse or the keyboard is on an element, for previewing a move before it is
 * played. Touch is left out: a tap plays straight away, so there is nothing to preview.
 */
export function hovering(onchange: (on: boolean) => void): Attachment<HTMLElement> {
  return (node) => {
    const point = (e: PointerEvent) => {
      if (e.pointerType !== "touch") onchange(true);
    };
    const focus = (e: FocusEvent) => {
      if (e.target instanceof Element && e.target.matches(":focus-visible")) onchange(true);
    };
    const leave = () => onchange(false);
    node.addEventListener("pointermove", point);
    node.addEventListener("pointerleave", leave);
    node.addEventListener("focusin", focus);
    node.addEventListener("focusout", leave);
    return () => {
      node.removeEventListener("pointermove", point);
      node.removeEventListener("pointerleave", leave);
      node.removeEventListener("focusin", focus);
      node.removeEventListener("focusout", leave);
    };
  };
}
