import { type ReactNode } from "react";
import Icon from "./Icon";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  accent?: "blue" | "lavender" | "yellow" | "green" | "red";
  change?: string;
  trend?: "up" | "down" | "neutral";
  children?: ReactNode;
  className?: string;
}

const ACCENT_CLASSES = {
  blue: { bg: "bg-brand-blue-soft", icon: "text-primary" },
  lavender: { bg: "bg-brand-lavender", icon: "text-primary-deep" },
  yellow: { bg: "bg-brand-yellow", icon: "text-primary-800" },
  green: { bg: "bg-success-light", icon: "text-success" },
  red: { bg: "bg-danger-light", icon: "text-danger" },
};

export default function StatCard({
  label,
  value,
  icon,
  accent = "blue",
  change,
  trend,
  children,
  className = "",
}: StatCardProps) {
  const colors = ACCENT_CLASSES[accent];

  return (
    <div className={`card ${className}`}>
      <div className="flex items-start gap-4">
        {icon && (
          <div className={`${colors.bg} rounded-xl p-2.5 flex-shrink-0`}>
            <Icon name={icon} size={20} className={colors.icon} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <p className="text-2xl font-bold text-foreground font-[family-name:var(--font-heading)]">
              {value}
            </p>
            {change && (
              <span
                className={`text-xs font-medium ${
                  trend === "up"
                    ? "text-success"
                    : trend === "down"
                    ? "text-danger"
                    : "text-gray-400"
                }`}
              >
                {change}
              </span>
            )}
          </div>
        </div>
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
