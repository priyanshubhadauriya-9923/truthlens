import type { ScanResult } from '../shared/types';
import { BADGE_LABELS } from '../shared/types';
import { formatConfidence } from '../shared/utils';

/**
 * Badge Engine
 *
 * Creates lightweight, Shadow DOM-isolated badges that attach to
 * media elements. Badges are responsive, non-blocking, and
 * animate smoothly. Uses multiple fallback strategies to ensure
 * visibility on any website.
 */

/** Create a scanning overlay on a media element */
export function showScanningOverlay(element: HTMLElement, mediaId: string) {
  if (document.querySelector(`[data-truthlens-scanning="${mediaId}"]`)) return;

  const isVoid = ['IMG', 'VIDEO', 'AUDIO'].includes(element.tagName);
  const target = isVoid ? element.parentElement : element;
  if (!target) return;

  ensureRelativePosition(target);

  const overlay = document.createElement('div');
  overlay.setAttribute('data-truthlens-scanning', mediaId);
  Object.assign(overlay.style, {
    position: 'absolute',
    top: isVoid ? `${element.offsetTop + 8}px` : '8px',
    right: isVoid ? `${target.offsetWidth - (element.offsetLeft + element.offsetWidth) + 8}px` : '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    background: 'rgba(15, 23, 42, 0.85)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderRadius: '6px',
    fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
    fontSize: '11px',
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    zIndex: '2147483647',
    pointerEvents: 'none',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  });

  const dot = document.createElement('div');
  Object.assign(dot.style, {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    border: '1.5px solid rgba(96, 165, 250, 0.3)',
    borderTopColor: '#60a5fa',
    animation: 'tl-spin 0.8s linear infinite',
  });

  const text = document.createElement('span');
  text.textContent = 'Scanning\u2026';

  overlay.appendChild(dot);
  overlay.appendChild(text);
  target.appendChild(overlay);
}

/** Remove scanning overlay */
export function removeScanningOverlay(element: HTMLElement, mediaId: string) {
  const overlay = document.querySelector(`[data-truthlens-scanning="${mediaId}"]`);
  if (overlay) overlay.remove();
}

/** Attach a result badge to a media element */
export function attachBadge(element: HTMLElement, result: ScanResult) {
  removeBadge(element, result.mediaId);

  const isVoid = ['IMG', 'VIDEO', 'AUDIO'].includes(element.tagName);
  const target = isVoid ? element.parentElement : element;
  if (!target) return;

  ensureRelativePosition(target);

  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-truthlens-badge', result.mediaId);
  Object.assign(wrapper.style, {
    position: 'absolute',
    top: isVoid ? `${element.offsetTop + 8}px` : '8px',
    left: isVoid ? `${element.offsetLeft + 8}px` : '8px',
    zIndex: '2147483647',
    pointerEvents: 'auto',
  });

  // Shadow DOM for style isolation
  const shadow = wrapper.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    .tl-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border-radius: 6px;
      font-family: Inter, -apple-system, system-ui, sans-serif;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.01em;
      line-height: 1;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      border: 1px solid rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      opacity: 0;
      transform: translateY(-4px) scale(0.95);
      animation: tl-badge-in 0.3s ease forwards;
      white-space: nowrap;
      user-select: none;
    }
    .tl-badge:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    }
    .tl-badge.authentic { background: rgba(34, 197, 94, 0.9); color: #fff; }
    .tl-badge.suspicious { background: rgba(245, 158, 11, 0.9); color: #fff; }
    .tl-badge.deepfake { background: rgba(239, 68, 68, 0.9); color: #fff; }
    .tl-icon {
      width: 12px; height: 12px;
      fill: none; stroke: currentColor;
      stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
    }
    @keyframes tl-badge-in {
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;

  const badge = document.createElement('div');
  badge.className = `tl-badge ${result.riskLevel}`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'tl-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  if (result.riskLevel === 'authentic') {
    path.setAttribute('d', 'M20 6L9 17l-5-5');
  } else if (result.riskLevel === 'suspicious') {
    path.setAttribute('d', 'M12 9v4m0 4h.01M12 2L2 22h20L12 2z');
  } else {
    path.setAttribute('d', 'M18.36 5.64a9 9 0 11-12.73 0M12 2v10');
  }
  svg.appendChild(path);

  const label = document.createElement('span');
  label.textContent = `${BADGE_LABELS[result.riskLevel]} \u2022 ${formatConfidence(result.confidence)}`;

  badge.appendChild(svg);
  badge.appendChild(label);

  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    window.postMessage({ type: 'TRUTHLENS_BADGE_CLICK', result }, '*');
  });

  shadow.appendChild(style);
  shadow.appendChild(badge);
  target.appendChild(wrapper);
}

/** Remove a badge from an element */
export function removeBadge(element: HTMLElement, mediaId: string) {
  const badge = document.querySelector(`[data-truthlens-badge="${mediaId}"]`);
  if (badge) badge.remove();
}

/** Remove all TruthLens badges from the page */
export function removeAllBadges() {
  document.querySelectorAll('[data-truthlens-badge]').forEach((el) => el.remove());
  document.querySelectorAll('[data-truthlens-scanning]').forEach((el) => el.remove());
}

/** Ensure element has relative positioning so absolute children work */
function ensureRelativePosition(el: HTMLElement) {
  const style = window.getComputedStyle(el);
  if (style.position === 'static') {
    el.style.position = 'relative';
  }
}
