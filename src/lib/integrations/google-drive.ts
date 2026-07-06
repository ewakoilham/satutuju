import "server-only";

import { Readable } from "stream";
import { google, type drive_v3 } from "googleapis";
import { makeOAuthClient } from "./google-calendar";

/**
 * Google Drive integration — archives student documents into the SatuTuju
 * Drive, one folder per student, for master-agency registration.
 *
 * Reuses the SAME admin OAuth grant as the calendar sync (refresh token in
 * the GoogleCalendarAuth singleton). Requires the drive.file scope — see
 * GOOGLE_CALENDAR_SCOPE; the admin must re-authorize at /api/auth/google
 * after that scope was added.
 *
 * Layout:  {root}/                       ← env GOOGLE_DRIVE_FOLDER_ID, or an
 *            SatuTuju - Dokumen Siswa/     auto-created root in My Drive
 *              {Nama Legal Siswa}/
 *                {Nama Dokumen} - vN.ext
 */

const ROOT_FOLDER_NAME = "SatuTuju - Dokumen Siswa";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export function makeDriveClient(refreshToken: string): drive_v3.Drive {
  const oauth = makeOAuthClient();
  oauth.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: "v3", auth: oauth });
}

/** Escape a value for a Drive `q` query string literal. */
function q(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Find a child by exact name inside a folder (non-trashed). */
async function findChild(
  drive: drive_v3.Drive,
  name: string,
  parentId: string | null,
  mimeType?: string,
): Promise<drive_v3.Schema$File | null> {
  const parts = [`name = '${q(name)}'`, "trashed = false"];
  if (parentId) parts.push(`'${q(parentId)}' in parents`);
  if (mimeType) parts.push(`mimeType = '${mimeType}'`);
  const res = await drive.files.list({
    q: parts.join(" and "),
    fields: "files(id, name)",
    pageSize: 1,
    spaces: "drive",
  });
  return res.data.files?.[0] ?? null;
}

/** Get-or-create a folder by name under `parentId` (or My Drive root). */
export async function ensureFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string | null,
): Promise<string> {
  const existing = await findChild(drive, name, parentId, FOLDER_MIME);
  if (existing?.id) return existing.id;
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: "id",
  });
  if (!created.data.id) throw new Error(`Drive folder creation returned no id for "${name}"`);
  return created.data.id;
}

/** Resolve the sync root: explicit env folder, else the auto-created one. */
export async function ensureRootFolder(drive: drive_v3.Drive): Promise<string> {
  const explicit = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (explicit) return explicit;
  return ensureFolder(drive, ROOT_FOLDER_NAME, null);
}

/** Upload a buffer into a folder unless a file with that exact name already
 *  exists there (idempotent re-sync without any DB bookkeeping).
 *  Returns "uploaded" | "skipped". */
export async function uploadIfMissing(
  drive: drive_v3.Drive,
  folderId: string,
  fileName: string,
  mimeType: string,
  data: Buffer,
): Promise<"uploaded" | "skipped"> {
  const existing = await findChild(drive, fileName, folderId);
  if (existing) return "skipped";
  await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType, body: Readable.from(data) },
    fields: "id",
  });
  return "uploaded";
}

export function folderWebUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}
