import Badge from "@/components/ui/Badge";
import {
  depositStatusLabel,
  type DepositDisplayStatus,
} from "@/lib/deposit-terms";

/**
 * Map persisted MenteeDeposit row → display status. No row = NOT_STARTED.
 * Single source of truth — used by the mentee deposit page, admin list,
 * and admin detail page.
 */
export function deriveDepositDisplayStatus(
  deposit: { status: string } | null | undefined,
): DepositDisplayStatus {
  if (!deposit) return "NOT_STARTED";
  const s = deposit.status;
  if (s === "VERIFIED" || s === "REJECTED" || s === "UPLOADED") return s;
  return "NOT_STARTED";
}

const VARIANT: Record<DepositDisplayStatus, "neutral" | "info" | "success" | "danger"> = {
  NOT_STARTED: "neutral",
  UPLOADED: "info",
  VERIFIED: "success",
  REJECTED: "danger",
};

export default function DepositStatusBadge({ status }: { status: DepositDisplayStatus }) {
  return <Badge variant={VARIANT[status]}>{depositStatusLabel(status)}</Badge>;
}
