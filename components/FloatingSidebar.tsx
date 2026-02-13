import { Settings } from 'lucide-react';

export function FloatingSidebar() {
  return (
    <div className="fixed right-6 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3 font-mono text-black">
      <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border-primary bg-background-quaternary shadow-sm transition-colors hover:bg-background-secondary">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-action-primary">
          <span className="text-[10px] text-white">A</span>
        </div>
      </button>

      <button className="flex h-12 w-12 items-center justify-center rounded-xl border border-border-primary bg-background-quaternary shadow-md transition-colors hover:bg-background-secondary">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-black"
        >
          <path d="M12 2L2 7L12 12L22 7L12 2Z" />
          <path d="M2 17L12 22L22 17" />
          <path d="M2 12L12 17L22 12" />
        </svg>
      </button>

      <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border-primary bg-background-quaternary shadow-sm transition-colors hover:bg-background-secondary">
        <Settings className="h-4 w-4 text-icon-primary" />
      </button>
    </div>
  );
}
