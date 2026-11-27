import { puzzles } from 'cubing/puzzles';
import { ExperimentalSVGAnimator } from 'cubing/twisty';
import { EVENTS } from '../shared/domain.js';
import type { EventId } from './types';

/** Render the final state of the actual scramble, starting from the solved puzzle. */
export async function createScrambleDiagram(
  event: EventId,
  alg: string,
  caseOrientation = false,
): Promise<SVGSVGElement> {
  const loader = puzzles[EVENTS[event].puzzle];
  const [kpuzzle, source] = await Promise.all([loader.kpuzzle(), loader.svg()]);
  const solved = kpuzzle.defaultPattern();
  // The 3×3 SVG starts white up. Case preparations start yellow up and green front.
  const pattern = (caseOrientation ? solved.applyMove('z2') : solved).applyAlg(alg);
  // The SVG source comes exclusively from cubing.js, never from user input.
  const drawing = new ExperimentalSVGAnimator(kpuzzle, source);
  drawing.drawPattern(pattern);
  const svg = drawing.svgElement as SVGSVGElement;
  // Use a simple unfolded net, without the extra hint stickers of the 3×3 template.
  svg.querySelectorAll('[data-copy-id]').forEach((element) => element.remove());
  svg.setAttribute('width', '100%');
  svg.removeAttribute('height');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.display = 'block';
  svg.style.width = '100%';
  svg.style.height = 'auto';
  return svg;
}

/** Trim the template margins after the SVG has been attached to the visible document. */
export function fitScrambleDiagram(svg: SVGSVGElement) {
  const bounds = svg.getBBox();
  if (bounds.width > 0 && bounds.height > 0) {
    const padding = 4;
    svg.setAttribute(
      'viewBox',
      `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`,
    );
  }
}
