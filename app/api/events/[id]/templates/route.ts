import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  extractTemplateFromZip,
  inlineTemplateImages,
  TemplateProcessingError,
} from "@/lib/emailTemplate";

async function assertOwnsEvent(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  return event && event.userId === userId ? event : null;
}

const VALID_KINDS = ["INVITACION", "CONFIRMACION", "RECORDATORIO"] as const;

const DEFAULT_TEMPLATE_LABELS: Record<(typeof VALID_KINDS)[number], string> = {
  INVITACION: "Plantilla básica — Invitación",
  CONFIRMACION: "Plantilla básica — Confirmación",
  RECORDATORIO: "Plantilla básica — Recordatorio",
};

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const event = await assertOwnsEvent(params.id, session.userId);
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const templates = await prisma.emailTemplate.findMany({
    where: { eventId: params.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, nombre: true, kind: true, createdAt: true },
  });

  // Las plantillas básicas siempre están disponibles, sin necesidad de subir
  // nada — se generan al momento del envío usando el logo/colores del
  // evento (ver lib/defaultEmailTemplate.ts). No viven en la base, por eso
  // usan un id sintético "default:<KIND>".
  const defaults = VALID_KINDS.map((kind) => ({
    id: `default:${kind}`,
    nombre: DEFAULT_TEMPLATE_LABELS[kind],
    kind,
    createdAt: null as string | null,
    isDefault: true as const,
  }));

  return NextResponse.json({ templates: [...defaults, ...templates] });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const event = await assertOwnsEvent(params.id, session.userId);
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Formulario inválido" }, { status: 400 });
  }

  const file = formData.get("file");
  const nombre = formData.get("nombre");
  const kind = formData.get("kind");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo ZIP" }, { status: 400 });
  }
  if (typeof nombre !== "string" || nombre.trim().length === 0) {
    return NextResponse.json({ error: "Falta el nombre de la plantilla" }, { status: 400 });
  }
  if (typeof kind !== "string" || !VALID_KINDS.includes(kind as any)) {
    return NextResponse.json({ error: "Tipo de plantilla inválido" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ error: "El archivo debe ser un .zip" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let htmlProcesado: string;
  try {
    const extracted = extractTemplateFromZip(buffer);
    htmlProcesado = inlineTemplateImages(extracted);
  } catch (err) {
    if (err instanceof TemplateProcessingError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "No se pudo procesar el ZIP. Verificá que sea una exportación válida de Postcards." },
      { status: 400 }
    );
  }

  const template = await prisma.emailTemplate.create({
    data: {
      eventId: params.id,
      nombre: nombre.trim(),
      kind: kind as (typeof VALID_KINDS)[number],
      archivoOriginal: file.name,
      htmlProcesado,
    },
    select: { id: true, nombre: true, kind: true, createdAt: true },
  });

  return NextResponse.json({ template });
}
