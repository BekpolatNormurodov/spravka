import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";
import type { QrCodeItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const token = cookies().get(COOKIE_NAME)?.value;
  const session = await verifySession(token);
  if (!session) redirect("/login");

  const rows = await prisma.qrCode.findMany({
    orderBy: { createdAt: "desc" },
  });

  const items: QrCodeItem[] = rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return (
    <DashboardClient
      initialItems={items}
      username={session.username}
      appUrl={appUrl}
    />
  );
}
