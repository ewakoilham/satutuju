"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import SignaturePad from "react-signature-canvas";
import Icon from "@/components/ui/Icon";

export type SignatureInputHandle = {
  /** PNG data-URL of the current signature (drawn or uploaded), or null. */
  getDataURL: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
};

interface SignatureInputProps {
  disabled?: boolean;
  /** Fired whenever the input transitions between empty / non-empty. */
  onEmptyChange?: (empty: boolean) => void;
}

type Mode = "draw" | "upload";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB plenty for a PNG signature

/**
 * Two-mode signature input:
 *
 *   1. "Gambar"  → in-browser canvas drawing (react-signature-canvas).
 *   2. "Unggah"  → file picker that accepts a transparent PNG of an
 *                  existing signature scan. The file is read via
 *                  FileReader into the same `data:image/png;base64,...`
 *                  shape the canvas produces, so the API + audit hash
 *                  pipeline doesn't need to know which mode was used.
 *
 * Switching mode clears the other mode's state — you can't combine
 * a drawn stroke with an uploaded image. The signed PDF embeds whatever
 * `getDataURL()` returns at submit time.
 */
const SignatureInput = forwardRef<SignatureInputHandle, SignatureInputProps>(
  function SignatureInput({ disabled, onEmptyChange }, ref) {
    const [mode, setMode] = useState<Mode>("draw");

    // Canvas state
    const padRef = useRef<SignaturePad>(null);
    const [canvasEmpty, setCanvasEmpty] = useState(true);

    // Upload state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);
    const [uploadedName, setUploadedName] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    function emit(empty: boolean) {
      onEmptyChange?.(empty);
    }

    function switchMode(next: Mode) {
      if (next === mode) return;
      // Clear the OTHER mode's state so the displayed input matches what
      // getDataURL() would return.
      if (next === "draw") {
        setUploadedDataUrl(null);
        setUploadedName(null);
        setUploadError(null);
      } else {
        padRef.current?.clear();
        setCanvasEmpty(true);
      }
      setMode(next);
      // After switching, the new mode starts empty.
      emit(true);
    }

    function handleFile(file: File | undefined) {
      setUploadError(null);
      if (!file) return;
      if (file.type !== "image/png") {
        setUploadError("File harus PNG (transparan).");
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setUploadError("Ukuran file maksimum 2 MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : null;
        if (!result || !result.startsWith("data:image/")) {
          setUploadError("File tidak dapat dibaca sebagai gambar.");
          return;
        }
        setUploadedDataUrl(result);
        setUploadedName(file.name);
        emit(false);
      };
      reader.onerror = () => setUploadError("Gagal membaca file.");
      reader.readAsDataURL(file);
    }

    useImperativeHandle(ref, () => ({
      getDataURL: () => {
        if (mode === "upload") return uploadedDataUrl;
        const pad = padRef.current;
        if (!pad || pad.isEmpty()) return null;
        return pad.toDataURL("image/png");
      },
      clear: () => {
        if (mode === "upload") {
          setUploadedDataUrl(null);
          setUploadedName(null);
          setUploadError(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        } else {
          padRef.current?.clear();
          setCanvasEmpty(true);
        }
        emit(true);
      },
      isEmpty: () => {
        if (mode === "upload") return !uploadedDataUrl;
        return padRef.current?.isEmpty() ?? true;
      },
    }));

    return (
      <div className="rounded-xl border border-border bg-surface p-3">
        {/* Mode toggle */}
        <div className="mb-3 inline-flex rounded-lg bg-background p-0.5 border border-border">
          <ModeTab active={mode === "draw"} onClick={() => switchMode("draw")} label="Gambar" />
          <ModeTab active={mode === "upload"} onClick={() => switchMode("upload")} label="Unggah PNG" />
        </div>

        {mode === "draw" ? (
          <>
            <div className="relative aspect-[3/1] w-full rounded-lg border border-dashed border-border bg-background overflow-hidden">
              <SignaturePad
                ref={padRef}
                canvasProps={{
                  className: "w-full h-full touch-none",
                  "aria-label": "Kanvas tanda tangan",
                  style: { cursor: disabled ? "not-allowed" : "crosshair" },
                }}
                onBegin={() => {
                  if (canvasEmpty) {
                    setCanvasEmpty(false);
                    emit(false);
                  }
                }}
                onEnd={() => {
                  const e = padRef.current?.isEmpty() ?? true;
                  setCanvasEmpty(e);
                  emit(e);
                }}
              />
              {canvasEmpty && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-text-muted-2">
                  Goreskan tanda tangan Anda di sini
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-text-muted-2">
              <span>Pastikan tanda tangan jelas dan terbaca</span>
              <button
                type="button"
                disabled={disabled}
                className="text-primary hover:underline disabled:opacity-50"
                onClick={() => {
                  padRef.current?.clear();
                  setCanvasEmpty(true);
                  emit(true);
                }}
              >
                Hapus
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              className="relative aspect-[3/1] w-full rounded-lg border border-dashed border-border bg-background overflow-hidden flex items-center justify-center"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (disabled) return;
                handleFile(e.dataTransfer.files?.[0]);
              }}
            >
              {uploadedDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={uploadedDataUrl}
                  alt="Pratinjau tanda tangan"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="text-center px-4">
                  <Icon name="upload" size={24} className="mx-auto text-text-muted-2 mb-1" />
                  <p className="text-sm font-medium text-foreground">
                    Pilih file PNG transparan
                  </p>
                  <p className="text-xs text-text-muted-2 mt-0.5">
                    Atau seret-lepas ke area ini. Maks. 2 MB.
                  </p>
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  className="btn-ghost text-xs px-3 py-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadedDataUrl ? "Ganti file" : "Pilih file"}
                </button>
                {uploadedName && (
                  <span className="text-text-muted-2 truncate max-w-[200px]">
                    {uploadedName}
                  </span>
                )}
              </div>
              {uploadedDataUrl && (
                <button
                  type="button"
                  disabled={disabled}
                  className="text-primary hover:underline disabled:opacity-50"
                  onClick={() => {
                    setUploadedDataUrl(null);
                    setUploadedName(null);
                    setUploadError(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                    emit(true);
                  }}
                >
                  Hapus
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png"
                className="hidden"
                disabled={disabled}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
            {uploadError && (
              <p className="mt-2 text-xs text-danger">{uploadError}</p>
            )}
            <p className="mt-2 text-[11px] text-text-muted-2 leading-snug">
              Disarankan: PNG dengan background transparan, tanda tangan
              hitam, lebar minimal 300px.
            </p>
          </>
        )}
      </div>
    );
  },
);

function ModeTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
        active
          ? "bg-surface text-foreground shadow-sm"
          : "text-text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

export default SignatureInput;
