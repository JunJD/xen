export function GrammarTokens() {
  const grammarTypes = [
    {
      id: 1,
      name: '主语',
      tag: 'S',
      color: 'bg-[#E3F2FD]',
      border: 'border-[#2196F3]',
      text: 'text-[#1976D2]',
    },
    {
      id: 2,
      name: '谓语',
      tag: 'V',
      color: 'bg-[#F3E5F5]',
      border: 'border-[#9C27B0]',
      text: 'text-[#7B1FA2]',
    },
    {
      id: 3,
      name: '宾语',
      tag: 'O',
      color: 'bg-[#E8F5E9]',
      border: 'border-[#4CAF50]',
      text: 'text-[#388E3C]',
    },
    {
      id: 4,
      name: '定语',
      tag: 'Attr',
      color: 'bg-[#FFF3E0]',
      border: 'border-[#FF9800]',
      text: 'text-[#F57C00]',
    },
    {
      id: 5,
      name: '状语',
      tag: 'Adv',
      color: 'bg-[#FCE4EC]',
      border: 'border-[#E91E63]',
      text: 'text-[#C2185B]',
    },
    {
      id: 6,
      name: '补语',
      tag: 'C',
      color: 'bg-[#F1F8E9]',
      border: 'border-[#8BC34A]',
      text: 'text-[#689F38]',
    },
    {
      id: 7,
      name: '介词短语',
      tag: 'PP',
      color: 'bg-[#E0F2F1]',
      border: 'border-[#009688]',
      text: 'text-[#00796B]',
    },
    {
      id: 8,
      name: '从句',
      tag: 'Clause',
      color: 'bg-[#FBE9E7]',
      border: 'border-[#FF5722]',
      text: 'text-[#E64A19]',
    },
    {
      id: 9,
      name: '连词',
      tag: 'Conj',
      color: 'bg-[#EDE7F6]',
      border: 'border-[#673AB7]',
      text: 'text-[#512DA8]',
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="mb-2 text-sm font-medium text-black">语法标注样式</h3>

      <div className="flex flex-col gap-2">
        {grammarTypes.map((type) => (
          <div key={type.id} className="flex items-center gap-3">
            <span className="w-16 text-[10px] text-text-tertiary">
              {type.name}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${type.color} ${type.text} ${type.border}`}
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
          <span className="inline-flex items-center gap-1 rounded border border-[#2196F3] bg-[#E3F2FD] px-2 py-0.5 text-[#1976D2]">
            <span className="text-[9px] opacity-60">S</span>
            <span>I</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded border border-[#9C27B0] bg-[#F3E5F5] px-2 py-0.5 text-[#7B1FA2]">
            <span className="text-[9px] opacity-60">V</span>
            <span>love</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded border border-[#4CAF50] bg-[#E8F5E9] px-2 py-0.5 text-[#388E3C]">
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
