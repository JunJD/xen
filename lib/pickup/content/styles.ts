import { STYLE_ID } from './constants';

export function ensurePickupStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .xen-pickup-token {
      display: inline;
      color: inherit;
      font: inherit;
      line-height: inherit;
      text-decoration-line: underline;
      text-decoration-color: var(--xen-pickup-accent, #2563eb);
      text-decoration-thickness: 2px;
      text-underline-offset: 2px;
      background-color: var(--xen-pickup-soft-bg, rgba(37, 99, 235, 0.12));
      border-radius: 2px;
      transition: background-color 0.15s ease;
    }
    .xen-pickup-token[data-pickup-category="grammar"] {
      --xen-pickup-accent: #2563eb;
      --xen-pickup-soft-bg: rgba(37, 99, 235, 0.12);
    }
    .xen-pickup-token[data-pickup-category="vocabulary"] {
      --xen-pickup-accent: #059669;
      --xen-pickup-soft-bg: rgba(5, 150, 105, 0.12);
    }
    .xen-pickup-token:hover {
      filter: brightness(0.98);
    }
    [data-pickup-status="loading"] {
      position: relative;
      outline: 1px dashed #cfd8dc;
      background: linear-gradient(120deg, #ffffff 0%, #e6f0ff 40%, #ffffff 80%);
      background-size: 200% 100%;
      animation: xen-pickup-pulse 1.2s ease-in-out infinite,
        xen-pickup-glow 2.4s ease-in-out infinite;
    }
    [data-pickup-status="error"] {
      outline: 1px dashed #ff4b4b;
      background: #fff7f7;
    }
    @keyframes xen-pickup-pulse {
      0% {
        background-position: 0% 50%;
      }
      100% {
        background-position: 200% 50%;
      }
    }
    @keyframes xen-pickup-glow {
      0% {
        box-shadow: 0 0 0 rgba(0, 67, 255, 0.12);
      }
      50% {
        box-shadow: 0 0 12px rgba(0, 67, 255, 0.28);
      }
      100% {
        box-shadow: 0 0 0 rgba(0, 67, 255, 0.12);
      }
    }
  `;
  document.head.appendChild(style);
}
