import { PICKUP_TYPES } from '@/lib/pickup/pickup-types';

const SAMPLE_SEGMENTS = [
  { text: 'I ', kind: null },
  { text: 'have been', kind: 'grammar' as const },
  { text: ' working ', kind: 'vocabulary' as const },
  { text: 'here ', kind: 'vocabulary' as const },
  { text: 'for', kind: 'grammar' as const },
  { text: ' three years.', kind: 'vocabulary' as const },
];

export function PickupTokens() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="mb-2 text-sm font-medium text-black">Grammar + Vocabulary Rendering</h3>

      <div className="flex flex-col gap-2">
        {PICKUP_TYPES.map(type => (
          <div key={type.id} className="flex items-center gap-3">
            <span className="w-20 text-[10px] text-text-tertiary">
              {type.name}
            </span>
            <span
              className="rounded px-2 py-0.5 text-xs"
              style={{
                textDecorationLine: 'underline',
                textDecorationColor: type.border,
                textDecorationThickness: '2px',
                textUnderlineOffset: '2px',
                backgroundColor: type.background,
                color: 'inherit',
              }}
            >
              {type.tag}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 rounded border border-border-primary bg-background-neutral p-3">
        <p className="text-xs leading-relaxed text-black">
          {SAMPLE_SEGMENTS.map(({ text, kind }, index) => {
            if (!kind) {
              return <span key={`${text}-${index}`}>{text}</span>;
            }
            const type = PICKUP_TYPES.find(item => item.kind === kind) ?? PICKUP_TYPES[0];
            return (
              <span
                key={`${text}-${index}`}
                className="rounded"
                style={{
                  textDecorationLine: 'underline',
                  textDecorationColor: type.border,
                  textDecorationThickness: '2px',
                  textUnderlineOffset: '2px',
                  backgroundColor: type.background,
                }}
              >
                {text}
              </span>
            );
          })}
        </p>
      </div>
    </div>
  );
}
