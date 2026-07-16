// Debug API endpoint to test authentication

import { NextRequest, NextResponse } from "next/server";
import { checkCredentials } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  return NextResponse.json({
    debug: {
      received: { username, password },
      expected: { username: adminUsername, password: adminPassword },
      envVarsSet: !!adminUsername && !!adminPassword,
      credentialsMatch: checkCredentials(username || "", password || ""),
      timestamp: new Date().toISOString(),
    },
  });
}
