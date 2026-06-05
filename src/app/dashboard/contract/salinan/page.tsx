"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import { useUser } from "@/lib/hooks";
import ContractPreview from "@/components/contract/ContractPreview";
import ContractTOC, {
  type ContractTocEntry,
} from "@/components/contract/ContractTOC";
import ContractTakeaways from "@/components/contract/ContractTakeaways";
import { useActiveAnchor } from "@/lib/use-active-anchor";
import type { PartialIdentity } from "@/lib/contract-template";

interface ContractRow {
  contractNumber: string;
  status: "PENDING_SIGNATURE" | "SIGNED" | "VOID";
  templateVersion: string;
  signedAt: string | null;
}

interface ContractApiResponse {
  contract: ContractRow | null;
  identity: PartialIdentity;
  identityCompleteness: number;
  identityRequired: number;
  contractVersion: string;
  needsResign: boolean;
  changelogSinceSigned: unknown[];
  previewHtml: string;
  previewToc: ContractTocEntry[];
}

/**
 * Dedicated full-width reader for the signed contract. Lives at
 * `/dashboard/contract/salinan`. Renders only the reader (TOC + body +
 * takeaway panel) at the layout's max-w-none, so the three-column
 * container has enough room for the takeaway sidebar without competing
 * with the main contract page's status / audit cards.
 *
 * Mentee + admin redirect to /dashboard; mentor without a signed
 * contract redirects back to /dashboard/contract.
 */
export default function ContractSalinanPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [data, setData] = useState<ContractApiResponse | null>(null);
  const [previewScrollEl, setPreviewScrollEl] =
    useState<HTMLDivElement | null>(null);

  const headingIds = useMemo(
    () => data?.previewToc.map((e) => e.id) ?? [],
    [data?.previewToc],
  );
  const activeId = useActiveAnchor(previewScrollEl, headingIds);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/mentor-contract", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as ContractApiResponse;
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "mentor") {
      router.push("/dashboard");
      return;
    }
    fetchData().then((d) => {
      if (!d) return;
      // Mentor must already be signed — otherwise bounce back to the
      // sign flow on the main contract page.
      if (d.contract?.status !== "SIGNED") {
        router.push("/dashboard/contract");
        return;
      }
      setData(d);
    });
  }, [loading, user, router, fetchData]);

  if (loading || !data) {
    return (
      <div className="py-8">
        <SkeletonDashboard />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 min-h-[calc(100vh-8rem)]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard/contract"
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-foreground mb-2"
          >
            <Icon name="chevron-left" size={14} />
            Kembali ke kontrak
          </Link>
          <h1 className="sesi-title">
            Salinan Perjanjian Kemitraan Mentor
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Nomor: <span className="font-mono">{data.contract?.contractNumber}</span>
            {" · "}Versi {data.contract?.templateVersion}
          </p>
        </div>
        <a
          href="/api/mentor-contract/pdf"
          target="_blank"
          rel="noopener"
          className="btn-ghost inline-flex items-center gap-2"
        >
          <Icon name="download" size={14} />
          Unduh PDF
        </a>
      </header>

      {/* Container queries make the reader adapt to its actual rendered
          width regardless of Windows scaling / browser zoom. */}
      <div className="@container flex-1">
        <div className="grid gap-3 items-start @[680px]:grid-cols-[180px_minmax(0,1fr)] @[1024px]:grid-cols-[200px_minmax(0,1fr)_300px] @[1024px]:gap-5">
          <aside className="hidden @[680px]:block">
            <div className="sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
              <ContractTOC
                entries={data.previewToc}
                scrollContainer={previewScrollEl}
                activeId={activeId}
              />
            </div>
          </aside>
          <ContractPreview
            ref={setPreviewScrollEl}
            html={data.previewHtml}
            className="contract-prose max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-border bg-surface p-4 @[680px]:p-6 @[1024px]:p-8"
          />
          <aside className="hidden @[1024px]:block">
            <div className="sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
              <ContractTakeaways
                entries={data.previewToc}
                activeId={activeId}
                variant="sidebar"
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
