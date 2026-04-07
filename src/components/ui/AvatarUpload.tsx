"use client";

import { useRef, useState } from "react";
import Avatar from "@/components/ui/Avatar";
import Icon from "@/components/ui/Icon";

interface AvatarUploadProps {
  name: string;
  src?: string | null;
  size?: "md" | "lg";
  onUploaded: (url: string) => void;
}

export default function AvatarUpload({ name, src, size = "lg", onUploaded }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const sizeClass = size === "lg" ? "w-16 h-16" : "w-12 h-12";

  const handleUpload = async (file: File) => {
    setError("");
    setUploading(true);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/avatar", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }

      onUploaded(data.avatar);
    } catch {
      setError("Network error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-start">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative group cursor-pointer"
      >
        {src ? (
          <img
            src={src}
            alt={name}
            className={`${sizeClass} rounded-full object-cover`}
          />
        ) : (
          <Avatar name={name} size={size} className={size === "lg" ? "!w-16 !h-16 !text-lg" : ""} />
        )}

        {/* Overlay */}
        <div className={`absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition ${uploading ? "!opacity-100" : ""}`}>
          {uploading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon name="upload" size={18} className="text-white" />
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }}
        />
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
