/**
 * Compact pipeline progress indicator — N small dots, the first `done`
 * dots are filled with brand primary, the rest are muted. Used in the
 * Smart Inbox row right column to show step-completion at a glance.
 */

interface Props {
  done: number;
  total: number;
}

export default function ProgressDots({ done, total }: Props) {
  if (total <= 0) return null;
  return (
    <div className="flex gap-[3px]" aria-label={`${done} dari ${total} step selesai`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i < done ? "bg-primary" : "bg-border"}`}
        />
      ))}
    </div>
  );
}
