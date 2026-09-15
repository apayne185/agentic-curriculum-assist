import { createRoot } from "react-dom/client";
import CvDocumentView from "@/components/CvDocument";
import type { CvDocument, CvStyle } from "./cv-schema";

const CSS_PX_PER_IN = 96;

/**
 * Renders the CV off-screen with the given style and measures its actual
 * content height in inches, by mounting a throwaway React root into a
 * hidden container sized to the page width (so text wraps identically to
 * the real preview) but with unconstrained height.
 */
export function measureCvHeightIn(cv: CvDocument, style: CvStyle): Promise<number> {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.top = "-99999px";
    container.style.left = "-99999px";
    container.style.visibility = "hidden";
    container.style.pointerEvents = "none";
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(<CvDocumentView cv={{ ...cv, style }} />);

    // Two rAFs to ensure layout has settled after the render commits.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const node = container.querySelector<HTMLElement>("[data-cv-page]");
        const heightPx = node?.scrollHeight ?? 0;
        root.unmount();
        document.body.removeChild(container);
        resolve(heightPx / CSS_PX_PER_IN);
      });
    });
  });
}
