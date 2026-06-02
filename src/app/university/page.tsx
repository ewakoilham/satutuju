import { redirect } from "next/navigation";

// Convenience alias: /university → /universities (the canonical directory).
export default function UniversityRedirect() {
  redirect("/universities");
}
