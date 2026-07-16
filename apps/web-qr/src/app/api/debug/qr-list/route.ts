import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const qrCodes = await prisma.qrCode.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        scans: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      total: qrCodes.length,
      items: qrCodes,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error), message: "Database error" },
      { status: 500 }
    );
  }
}
