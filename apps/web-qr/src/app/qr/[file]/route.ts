import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

/**
 * Serve a generated QR PNG off disk.
 *
 * Next only serves the public/ files that existed when the process started, so a
 * QR generated at runtime 404s until the next restart. Measured on this box: a
 * PNG written before start returns 200, one written after returns 404, same
 * directory, same request. That is why the standalone deploy served /qr/ from an
 * nginx alias, and deploy/nginx still does — but the app should not be broken
 * without a reverse proxy in front of it.
 *
 * Static public/ files still win for anything present at startup; this only
 * catches what falls through.
 *
 * NOT YET VERIFIED: :5000 is running a production build, so this route is not in
 * its bundle, and rebuilding would take the running server down. Confirm after
 * the next build with a QR created post-start.
 */

// A bare filename and nothing else. public/qr/ is two levels under the app root,
// where .env lives, so a slash or a dot-dot here would be a file-read primitive.
const SAFE_NAME = /^[A-Za-z0-9_-]{1,64}\.png$/;

export async function GET(
  _req: Request,
  { params }: { params: { file: string } }
) {
  if (!SAFE_NAME.test(params.file)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const buf = await readFile(
      path.join(process.cwd(), "public", "qr", params.file)
    );
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/png",
        // The id is content-addressed by nanoid, so a given name never changes.
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
