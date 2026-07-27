import { z } from "zod";

export const registerSchema = z.object({
  nombre: z.string().min(2, "El nombre es muy corto").max(100),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export const eventSchema = z.object({
  nombreEvento: z.string().min(2).max(150),
  tipoEvento: z.string().min(2).max(50),
  fecha: z.string(), // ISO date, ej "2026-11-20"
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato HH:mm"),
  horaFin: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato HH:mm")
    .optional()
    .or(z.literal("")),
  timezone: z.string().default("America/Argentina/Buenos_Aires"),
  descripcion: z.string().max(2000).optional().or(z.literal("")),
  nombreLugar: z.string().max(150).optional().or(z.literal("")),
  direccion: z.string().max(250).optional().or(z.literal("")),
  mapaUrl: z.string().url().optional().or(z.literal("")),
  logo: z.string().url("Tiene que ser una URL válida").optional().or(z.literal("")),
  colorPrincipal: z
    .string()
    .regex(/^#([0-9a-fA-F]{6})$/, "Color hex inválido")
    .default("#111827"),
  colorSecundario: z
    .string()
    .regex(/^#([0-9a-fA-F]{6})$/, "Color hex inválido")
    .default("#6366F1"),
  estado: z.enum(["BORRADOR", "ACTIVO", "FINALIZADO"]).optional(),
});

export const guestSchema = z.object({
  nombre: z.string().min(1).max(100),
  apellido: z.string().min(1).max(100),
  email: z.string().email("Email inválido"),
  telefono: z.string().max(30).optional().or(z.literal("")),
  cantidadPersonasPermitidas: z.coerce.number().int().min(1).max(20).default(1),
});

export const emailProviderSettingsSchema = z.object({
  provider: z.enum(["RESEND", "BREVO"]),
  apiKey: z.string().min(10, "La API key parece incompleta").optional().or(z.literal("")),
  fromEmail: z.string().email("Email inválido"),
  fromName: z.string().min(1, "El nombre del remitente es requerido").max(100),
  testModeEnabled: z.boolean().default(false),
  testRecipientEmail: z.string().email("Email de prueba inválido").optional().or(z.literal("")),
});

export const testEmailSchema = emailProviderSettingsSchema.extend({
  apiKey: z.string().min(10, "La API key parece incompleta"),
  to: z.string().email("Email de destino inválido"),
});

export const sendInvitationsSchema = z.object({
  templateId: z.string().min(1, "Seleccioná una plantilla"),
  guestIds: z.array(z.string()).min(1, "Seleccioná al menos un invitado"),
});

export const rsvpResponseSchema = z.object({
  asistira: z.boolean(),
  cantidadConfirmada: z.coerce.number().int().min(0).max(20).optional(),
  comentarios: z.string().max(500).optional().or(z.literal("")),
});
