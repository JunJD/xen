import { PICKUP_TYPES } from '@/lib/pickup/pickup-types';

export function PickupTokens() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="mb-2 text-sm font-medium text-black">语法标注样式</h3>

      <div className="flex flex-col gap-2">
        {PICKUP_TYPES.map((type) => (
          <div key={type.id} className="flex items-center gap-3">
            <span className="w-16 text-[10px] text-text-tertiary">
              {type.name}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs"
              style={{
                backgroundColor: type.background,
                borderColor: type.border,
                color: type.text,
              }}
            >
              <span className="text-[9px] opacity-60">{type.tag}</span>
              <span>example</span>
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 border-t border-border-primary pt-2">
        <span className="w-16 text-[10px] text-text-tertiary">普通词汇</span>
        <span className="rounded border border-border-primary bg-background-secondary px-2 py-0.5 text-xs text-black">
          token
        </span>
      </div>

      <div className="mt-4 rounded border border-border-primary bg-background-neutral p-3">
        <div className="flex flex-wrap gap-1 text-xs leading-relaxed">
          <span
            className="inline-flex items-center gap-1 rounded border px-2 py-0.5"
            style={{
              backgroundColor: PICKUP_TYPES[0].background,
              borderColor: PICKUP_TYPES[0].border,
              color: PICKUP_TYPES[0].text,
            }}
          >
            <span className="text-[9px] opacity-60">S</span>
            <span>I</span>
          </span>
          <span
            className="inline-flex items-center gap-1 rounded border px-2 py-0.5"
            style={{
              backgroundColor: PICKUP_TYPES[1].background,
              borderColor: PICKUP_TYPES[1].border,
              color: PICKUP_TYPES[1].text,
            }}
          >
            <span className="text-[9px] opacity-60">V</span>
            <span>love</span>
          </span>
          <span
            className="inline-flex items-center gap-1 rounded border px-2 py-0.5"
            style={{
              backgroundColor: PICKUP_TYPES[2].background,
              borderColor: PICKUP_TYPES[2].border,
              color: PICKUP_TYPES[2].text,
            }}
          >
            <span className="text-[9px] opacity-60">O</span>
            <span>programming</span>
          </span>
          <span className="rounded border border-border-primary bg-background-secondary px-2 py-0.5 text-black">
            .
          </span>
        </div>
      </div>
    </div>
  );
}
