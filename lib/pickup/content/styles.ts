import { STYLE_ID } from './constants';

export function ensurePickupStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .xen-pickup-token {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border-radius: 6px;
      border: 1px solid transparent;
      padding: 2px 6px;
      font-family: Menlo, Monaco, monospace;
      font-size: 12px;
      line-height: 1.4;
      white-space: nowrap;
    }
    .xen-pickup-tag {
      font-size: 9px;
      opacity: 0.6;
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
