import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const qrCode = await prisma.qrCode.findUnique({
      where: { id: params.id },
    });

    if (!qrCode) {
      return NextResponse.json(
        { error: "QR code not found", id: params.id },
        { status: 404 }
      );
    }

    return NextResponse.json(qrCode);
  } catch (error) {
    return NextResponse.json(
      { error: String(error), message: "Database error" },
      { status: 500 }
    );
  }
}
