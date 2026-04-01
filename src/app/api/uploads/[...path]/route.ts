import { NextRequest, NextResponse } from "next/server";

// Legacy route — files are now stored in Supabase Storage.
// This route handles any old references by redirecting to Supabase.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const storagePath = pathSegments.join("/");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (supabaseUrl) {
    // Redirect to Supabase Storage public URL
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/documents/${storagePath}`;
    return NextResponse.redirect(publicUrl);
  }

  return NextResponse.json({ error: "File not found" }, { status: 404 });
}
