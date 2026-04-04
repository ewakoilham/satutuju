import { type ReactNode } from "react";

interface BadgeProps {
  variant?: "success" | "warning" | "danger" | "info" | "neutral" | "primary" | "brand";
  size?: "sm" | "md";
  children: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<string, string> = {
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger",
  info: "badge-info",
  neutral: "badge-neutral",
  primary: "badge-primary",
  brand: "badge-brand",
};

export default function Badge({ variant = "neutral", size = "sm", children, className = "" }: BadgeProps) {
  const sizeClass = size === "md" ? "text-sm px-3 py-0.5" : "";

  return (
    <span className={`badge ${VARIANT_CLASSES[variant]} ${sizeClass} ${className}`}>
      {children}
    </span>
  );
}
