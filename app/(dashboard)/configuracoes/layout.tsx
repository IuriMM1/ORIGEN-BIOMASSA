"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchMyAppProfile, isAdminRole } from "@/lib/app-profile";
import { supabase } from "@/lib/supabase";

const primary = "#143328";

export default function ConfiguracoesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "allowed" | "denied" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profile = await fetchMyAppProfile(supabase);
      if (cancelled) return;
      if (!profile) {
        setState("error");
        return;
      }
      if (!isAdminRole(profile.role)) {
        setState("denied");
        return;
      }
      setState("allowed");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6 text-sm text-gray-500">
        A verificar permissões…
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-lg font-semibold text-gray-900">Acesso restrito</p>
        <p className="mt-2 text-sm text-gray-600">
          A área de Configurações está disponível apenas para utilizadores com perfil de{" "}
          <strong>administrador</strong>.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold hover:underline" style={{ color: primary }}>
          Voltar ao painel
        </Link>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-lg font-semibold text-gray-900">Perfil indisponível</p>
        <p className="mt-2 text-sm text-gray-600">
          Não foi possível ler o seu perfil (<code className="rounded bg-gray-100 px-1 text-xs">app_profiles</code>). Aplique as migrações
          recentes no Supabase ou volte a iniciar sessão.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-6 text-sm font-semibold hover:underline"
          style={{ color: primary }}
        >
          Ir para o painel
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
