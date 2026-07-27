import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildCheckinCode } from "@/lib/checkin";

async function assertOwnsEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  return event && event.userId === userId ? event : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; guestId: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const event = await assertOwnsEvent(params.id, session.userId);
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const guest = await prisma.guest.findFirst({
    where: { id: params.guestId, eventId: event.id },
  });
  if (!guest) return NextResponse.json({ error: "Invitado no encontrado" }, { status: 404 });

  const png = await QRCode.toBuffer(buildCheckinCode(guest.tokenUnico), {
    type: "png",
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#111827",
      light: "#ffffff",
    },
  });

  const filename = `${guest.nombre}-${guest.apellido}-qr.png`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="${filename || "qr"}.png"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
