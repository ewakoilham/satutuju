/**
 * Compact label + value cell used inside contract metadata grids on
 * both the mentor's signed view (`/dashboard/contract`) and the admin
 * detail view (`/dashboard/admin/contracts/[userId]`).
 */
export default function Field({
  label,
  value,
  mono,
  collapse,
}: {
  label: string;
  value: string;
  /** Render the value in monospace — useful for hashes, IPs, raw IDs. */
  mono?: boolean;
  /** Span both columns of a 2-col grid (for long values like UA strings). */
  collapse?: boolean;
}) {
  return (
    <div className={collapse ? "sm:col-span-2" : ""}>
      <dt className="text-xs uppercase tracking-wide text-text-muted-2">
        {label}
      </dt>
      <dd className={`mt-0.5 text-foreground break-all ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
