import { redirect } from "next/navigation";

// Public self-signup is disabled — Satu Tuju is invite-only. Accounts are
// created by an admin or via an admin email invite (→ /activate). Anyone
// hitting the old /signup URL is sent to the login page.
export default function SignupPage() {
  redirect("/login");
}
