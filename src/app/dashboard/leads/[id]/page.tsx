import { redirect } from "next/navigation";

/**
 * Phase 13.1 shim: the standalone mentor lead detail page has been
 * merged into the list page's side panel. This route stays as a
 * redirect so existing bookmarks + notification deep-links (which
 * point at /dashboard/leads/<id>) still work.
 */
export default async function MentorLeadDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/leads?id=${encodeURIComponent(id)}`);
}
