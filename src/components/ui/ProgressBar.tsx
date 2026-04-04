interface ProgressBarProps {
  value: number; // 0-100
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  label?: string;
  className?: string;
}

const SIZES = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-3.5",
};

export default function ProgressBar({
  value,
  size = "md",
  showValue = false,
  label,
  className = "",
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-xs font-medium text-gray-600">{label}</span>}
          {showValue && (
            <span className="text-xs font-semibold text-primary">{Math.round(clamped)}%</span>
          )}
        </div>
      )}
      <div className={`w-full ${SIZES[size]} bg-brand-lavender/50 rounded-full overflow-hidden`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary-deep transition-all duration-500 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
