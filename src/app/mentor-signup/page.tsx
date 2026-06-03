import { redirect } from "next/navigation";

// Mentor self-signup is disabled — Satu Tuju is invite-only. Mentors are
// onboarded via an admin email invite (→ /activate), not an open link.
// Anyone hitting the old /mentor-signup URL is sent to the login page.
export default function MentorSignupPage() {
  redirect("/login");
}
