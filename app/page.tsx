import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <span className="mb-4 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
        MVP
      </span>
      <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
        Event Flow
      </h1>
      <p className="mt-4 max-w-md text-neutral-500">
        Creá eventos, invitá personas y recibí confirmaciones desde una sola plataforma.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/register" className="btn-primary">
          Crear cuenta
        </Link>
        <Link href="/login" className="btn-secondary">
          Iniciar sesión
        </Link>
      </div>
    </main>
  );
}
