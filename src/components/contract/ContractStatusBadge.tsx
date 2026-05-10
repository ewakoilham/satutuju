import Badge from "@/components/ui/Badge";

export type ContractDisplayStatus =
  | "NOT_STARTED"
  | "IDENTITY_INCOMPLETE"
  | "READY_TO_SIGN"
  | "SIGNED"
  | "VOID";

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
