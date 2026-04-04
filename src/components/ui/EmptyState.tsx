import { type ReactNode } from "react";
import Icon from "./Icon";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon = "puzzle",
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`text-center py-16 px-4 ${className}`}>
      {/* Decorative icon with brand colors */}
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-blue-soft mb-4">
        <Icon name={icon} size={28} className="text-primary" />
      </div>

      <h3 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)]">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      )}

      {action && <div className="mt-6">{action}</div>}

      {/* Decorative dots */}
      <div className="flex items-center justify-center gap-1.5 mt-8">
        <div className="w-1.5 h-1.5 rounded-full bg-brand-yellow" />
        <div className="w-1.5 h-1.5 rounded-full bg-brand-lavender" />
        <div className="w-1.5 h-1.5 rounded-full bg-brand-blue-soft" />
      </div>
    </div>
  );
}
