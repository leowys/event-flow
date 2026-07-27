"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Settings = {
  configured: boolean;
  provider?: "RESEND" | "BREVO";
  fromEmail?: string;
  fromName?: string;
  apiKeyMasked?: string;
  testModeEnabled?: boolean;
  testRecipientEmail?: string | null;
};

const providerInfo = {
  RESEND: {
    label: "Resend",
    helpUrl: "https://resend.com/api-keys",
    helpText: "Generá la key en Dashboard → API Keys.",
  },
  BREVO: {
    label: "Brevo",
    helpUrl: "https://app.brevo.com/settings/keys/api",
    helpText: "Generá la key en Settings → SMTP & API → API Keys.",
  },
};

export default function EmailSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const [provider, setProvider] = useState<"RESEND" | "BREVO">("RESEND");
  const [apiKey, setApiKey] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [testRecipientEmail, setTestRecipientEmail] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/settings/email")
      .then((res) => res.json())
      .then((data: Settings) => {
        setSettings(data);
        if (data.configured) {
          setProvider(data.provider!);
          setFromName(data.fromName!);
          setFromEmail(data.fromEmail!);
          setTestModeEnabled(Boolean(data.testModeEnabled));
          setTestRecipientEmail(data.testRecipientEmail ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    if (!apiKey.trim() && !settings?.configured) {
      setSaveError("Ingresá la API key");
      return;
    }
    if (testModeEnabled && !testRecipientEmail.trim()) {
      setSaveError("Ingresá el email al que querés redirigir los envíos de prueba.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/settings/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        apiKey,
        fromEmail,
        fromName,
        testModeEnabled,
        testRecipientEmail,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setSaveError(data.error ?? "No se pudo guardar la configuración");
      return;
    }

    setSettings(data);
    setApiKey("");
    setSaveSuccess(true);
  }

  async function handleTest() {
    setTestError(null);
    setTestSuccess(false);

    if (!testTo.trim()) {
      setTestError("Ingresá un email de destino para la prueba");
      return;
    }
    if (!apiKey.trim()) {
      setTestError(
        "Por seguridad no guardamos la API key en texto plano, así que para probar necesitás volver a pegarla arriba (aunque ya tengas una configuración guardada)."
      );
      return;
    }

    setTesting(true);
    const res = await fetch("/api/settings/email/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey, fromEmail, fromName, to: testTo }),
    });
    const data = await res.json();
    setTesting(false);

    if (!res.ok) {
      setTestError(data.error ?? "No se pudo enviar el email de prueba");
      return;
    }

    setTestSuccess(true);
  }

  async function handleRemove() {
    const confirmed = window.confirm("¿Quitar la configuración de email guardada?");
    if (!confirmed) return;

    await fetch("/api/settings/email", { method: "DELETE" });
    setSettings({ configured: false });
    setApiKey("");
    setFromName("");
    setFromEmail("");
    setTestModeEnabled(false);
    setTestRecipientEmail("");
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Cargando...</p>;
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Volver
      </Link>

      <h1 className="mb-1 mt-2 text-2xl font-semibold tracking-tight">Ajustes de email</h1>
      <p className="mb-8 text-sm text-neutral-500">
        Elegí con qué plataforma se envían las invitaciones, confirmaciones y emails de
        verificación de cuenta.
      </p>

      {settings?.configured && (
        <div className="card mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-500">Configuración activa</p>
            <p className="font-medium">
              {providerInfo[settings.provider!].label} · {settings.fromName} &lt;
              {settings.fromEmail}&gt;
            </p>
            <p className="mt-1 text-xs text-neutral-400">API key: {settings.apiKeyMasked}</p>
            {settings.testModeEnabled && settings.testRecipientEmail && (
              <p className="mt-1 text-xs text-amber-600">
                Modo prueba activo: todos los envíos van a {settings.testRecipientEmail}
              </p>
            )}
          </div>
          <button onClick={handleRemove} className="btn-secondary text-red-600">
            Quitar
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="card space-y-5">
        <div>
          <label className="label">Proveedor</label>
          <div className="grid grid-cols-2 gap-3">
            {(["RESEND", "BREVO"] as const).map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setProvider(p)}
                className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                  provider === p
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {providerInfo[p].label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            {providerInfo[provider].helpText}{" "}
            <a href={providerInfo[provider].helpUrl} target="_blank" className="underline">
              Ir a {providerInfo[provider].label}
            </a>
          </p>
        </div>

        <div>
          <label className="label">
            API key {settings?.configured && "(dejar vacío para mantener la actual)"}
          </label>
          <input
            type="password"
            className="input"
            placeholder={settings?.configured ? settings.apiKeyMasked : "re_xxxxxxxxxxxx"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Nombre del remitente</label>
            <input
              required
              className="input"
              placeholder="Event Flow"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Email del remitente</label>
            <input
              type="email"
              required
              className="input"
              placeholder="no-reply@tudominio.com"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <label className="flex items-start gap-3 text-sm text-amber-900">
            <input
              type="checkbox"
              className="mt-1"
              checked={testModeEnabled}
              onChange={(e) => setTestModeEnabled(e.target.checked)}
            />
            <span>
              <span className="font-medium">Modo prueba</span>
              <span className="mt-1 block text-amber-800">
                Redirige todos los emails reales a un único destinatario. Útil para probar con
                Resend sin dominio verificado.
              </span>
            </span>
          </label>

          {testModeEnabled && (
            <div className="mt-4">
              <label className="label">Enviar todos los emails a</label>
              <input
                type="email"
                className="input"
                placeholder="leowys@gmail.com"
                value={testRecipientEmail}
                onChange={(e) => setTestRecipientEmail(e.target.value)}
              />
            </div>
          )}
        </div>

        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        {saveSuccess && <p className="text-sm text-green-700">Configuración guardada.</p>}

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? "Guardando..." : "Guardar configuración"}
        </button>
      </form>

      <div className="card mt-6">
        <h2 className="mb-1 font-medium">Probar antes de guardar</h2>
        <p className="mb-4 text-sm text-neutral-500">
          Completá el proveedor y la API key arriba, y mandate un email de prueba a vos mismo.
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            className="input"
            placeholder="tu-email@ejemplo.com"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
          />
          <button onClick={handleTest} disabled={testing} className="btn-secondary whitespace-nowrap">
            {testing ? "Enviando..." : "Enviar prueba"}
          </button>
        </div>
        {testError && <p className="mt-2 text-sm text-red-600">{testError}</p>}
        {testSuccess && <p className="mt-2 text-sm text-green-700">Email de prueba enviado.</p>}
      </div>
    </div>
  );
}
