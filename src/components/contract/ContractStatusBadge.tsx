import Badge from "@/components/ui/Badge";

export type ContractDisplayStatus =
  | "NOT_STARTED"
  | "IDENTITY_INCOMPLETE"
  | "READY_TO_SIGN"
  | "SIGNED"
  | "VOID";

/**
 * Map (persisted contract status, identity completeness) → display status.
 * Single source of truth — used by the mentor page, admin list, admin
 * detail page, and DashboardContractAlert.
 */
export function deriveContractDisplayStatus(input: {
  contract: { status: string } | null | undefined;
  identityCompleteness: number;
  identityRequired: number;
}): ContractDisplayStatus {
  const s = input.contract?.status;
  if (s === "SIGNED") return "SIGNED";
  if (s === "VOID") return "VOID";
  if (input.identityCompleteness === 0) return "NOT_STARTED";
  if (input.identityCompleteness < input.identityRequired) return "IDENTITY_INCOMPLETE";
  return "READY_TO_SIGN";
}

const VARIANT: Record<ContractDisplayStatus, "neutral" | "warning" | "info" | "success" | "danger"> = {
  NOT_STARTED:         "neutral",
  IDENTITY_INCOMPLETE: "warning",
  READY_TO_SIGN:       "info",
  SIGNED:              "success",
  VOID:                "danger",
};

const LABEL_ID: Record<ContractDisplayStatus, string> = {
  NOT_STARTED:         "Belum dimulai",
  IDENTITY_INCOMPLETE: "Data identitas belum lengkap",
  READY_TO_SIGN:       "Siap ditandatangani",
  SIGNED:              "Sudah ditandatangani",
  VOID:                "Dibatalkan",
};

export default function ContractStatusBadge({ status }: { status: ContractDisplayStatus }) {
  return <Badge variant={VARIANT[status]}>{LABEL_ID[status]}</Badge>;
}

export const CONTRACT_STATUS_LABEL = LABEL_ID;
