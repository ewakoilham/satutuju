"use client";

import dynamic from "next/dynamic";
import { usePhotoEditContext } from "@/lib/photo-edit-context";

// Lazy + gated on isAdmin so the chunk only ships for admin users.
const PhotoEditToolbar = dynamic(() => import("./PhotoEditToolbar"), {
  ssr: false,
});

export default function AdminOnlyToolbar() {
  const ctx = usePhotoEditContext();
  if (!ctx?.isAdmin) return null;
  return <PhotoEditToolbar />;
}
