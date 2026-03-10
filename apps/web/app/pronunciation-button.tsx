"use client";

type PronunciationButtonProps = {
  text: string;
  lang?: string;
  label?: string;
  className?: string;
};

type PronunciationChipProps = {
  text: string;
  lang: string;
  region: string;
  value: string;
  className?: string;
};

function speakText(text: string, lang: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.95;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

export function PronunciationButton({
  text,
  lang = "en-US",
  label = "播放",
  className,
}: PronunciationButtonProps) {
  return (
    <button
      type="button"
      className={className ?? "pronunciation-button"}
      onClick={() => speakText(text, lang)}
    >
      {label}
    </button>
  );
}

export function PronunciationChip({
  text,
  lang,
  region,
  value,
  className,
}: PronunciationChipProps) {
  return (
    <button
      type="button"
      className={className ?? "xen-pickup-tooltip-phone-chip"}
      aria-label={`朗读${region}音标`}
      onClick={() => speakText(text, lang)}
    >
      <span className="xen-pickup-tooltip-phone-region">{region}</span>
      <span className="xen-pickup-tooltip-phone-value">{value}</span>
    </button>
  );
}
