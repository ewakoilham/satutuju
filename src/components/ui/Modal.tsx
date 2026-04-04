"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Icon from "./Icon";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
  variant?: "default" | "danger";
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  variant = "default",
  size = "sm",
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Focus trap
  useEffect(() => {
    if (!open || !contentRef.current) return;
    const firstFocusable = contentRef.current.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    firstFocusable?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-primary-900/30 backdrop-blur-sm animate-fade-in" />

      {/* Modal content */}
      <div
        ref={contentRef}
        className={`relative w-full ${SIZE_CLASSES[size]} bg-white rounded-2xl shadow-xl animate-scale-in overflow-hidden`}
      >
        {/* Header */}
        {(title || description) && (
          <div className="px-6 pt-6 pb-2">
            <div className="flex items-start justify-between">
              <div>
                {title && (
                  <h3
                    className={`text-lg font-semibold font-[family-name:var(--font-heading)] ${
                      variant === "danger" ? "text-danger" : "text-foreground"
                    }`}
                  >
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-sm text-gray-500 mt-1">{description}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        {children && <div className="px-6 py-3">{children}</div>}

        {/* Actions */}
        {actions && (
          <div className="px-6 py-4 bg-gray-50/50 flex items-center justify-end gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/* Convenience: Confirm dialog */
interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: "default" | "danger";
  loading?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "default",
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      variant={variant}
      actions={
        <>
          <button onClick={onClose} className="btn-ghost" disabled={loading}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={variant === "danger" ? "btn-danger" : "btn-primary"}
            disabled={loading}
          >
            {loading ? "..." : confirmLabel}
          </button>
        </>
      }
    />
  );
}
