"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { fetchMyAppProfile, isAdminRole, syncAppProfileGapsFromMetadata, touchLastSeen, type AppProfileRow } from "@/lib/app-profile";
import { supabase } from "@/lib/supabase";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`ml-auto h-4 w-4 shrink-0 text-white/45 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Estilo dos itens de navegação na barra lateral */
const navItemBase =
  "mb-1 flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-medium text-white/65 transition hover:bg-white/10 hover:text-white";
const navItemActive = "bg-white/[0.15] text-white";

function initialsFromUser(user: User | null): string {
  if (!user?.email) return "?";
  const meta = user.user_metadata as Record<string, string | undefined> | undefined;
  const name = meta?.full_name || meta?.name;
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return user.email.slice(0, 2).toUpperCase();
}

function displayName(user: User | null, profile: AppProfileRow | null): string {
  if (!user) return "Convidado";
  const fromProfile = profile?.full_name?.trim();
  if (fromProfile) return fromProfile;
  const meta = user.user_metadata as Record<string, string | undefined> | undefined;
  return (meta?.full_name || meta?.name || user.email?.split("@")[0] || "Utilizador").trim();
}

function avatarUrl(user: User | null): string | null {
  if (!user) return null;
  const meta = user.user_metadata as Record<string, string | undefined> | undefined;
  return meta?.avatar_url || meta?.picture || null;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [fornecedoresOpen, setFornecedoresOpen] = useState(false);
  const [analisesOpen, setAnalisesOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [appProfile, setAppProfile] = useState<AppProfileRow | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const isAdmin = useMemo(() => isAdminRole(appProfile?.role), [appProfile?.role]);

  const userInitials = useMemo(() => initialsFromUser(user), [user]);
  const userName = useMemo(() => displayName(user, appProfile), [user, appProfile]);
  const userPhoto = useMemo(() => avatarUrl(user), [user]);

  useEffect(() => {
    if (pathname.startsWith("/fornecedores")) setFornecedoresOpen(true);
    if (pathname.startsWith("/analises")) setAnalisesOpen(true);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user ?? null;
      if (!cancelled) setUser(u);
      if (u && !cancelled) {
        const p = await fetchMyAppProfile(supabase);
        if (!cancelled) setAppProfile(p);
        await syncAppProfileGapsFromMetadata(supabase, u.id, u.user_metadata as Record<string, unknown>);
        await touchLastSeen(supabase, u.id);
      } else if (!cancelled) setAppProfile(null);
    })();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const p = await fetchMyAppProfile(supabase);
        setAppProfile(p);
        await syncAppProfileGapsFromMetadata(supabase, u.id, u.user_metadata as Record<string, unknown>);
        await touchLastSeen(supabase, u.id);
      } else {
        setAppProfile(null);
      }
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-72 flex-col overflow-hidden border-r border-black/25 bg-[#042417] text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="relative h-full min-h-full w-full">
          <Image
            src="/sidebar-image.png"
            alt=""
            fill
            className="object-cover object-left"
            sizes="288px"
            priority
          />
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {/* Espaço no topo (zona da logo na imagem); o menu começa mais abaixo */}
        <nav className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-36">
        <Link
          href="/"
          className={`${navItemBase} ${pathname === "/" ? navItemActive : ""}`}
        >
          <span className="mr-3 h-2 w-2 shrink-0 rounded-full bg-[#1F7A63]" />
          Dashboard
        </Link>

        <div className="mb-1">
          <button type="button" className={navItemBase} onClick={() => setFornecedoresOpen((o) => !o)} aria-expanded={fornecedoresOpen}>
            <span className="mr-3 h-2 w-2 shrink-0 rounded-full bg-[#1F7A63]" />
            Fornecedores
            <Chevron open={fornecedoresOpen} />
          </button>
          {fornecedoresOpen ? (
            <div className="mt-0.5 space-y-0.5 border-l border-white/10 ml-4 pl-3">
              <Link
                href="/fornecedores/cadastro"
                className={`flex items-center rounded-lg py-2 pl-9 pr-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white ${
                  pathname === "/fornecedores/cadastro" ? `${navItemActive} rounded-lg` : ""
                }`}
              >
                Cadastro de Fornecedores
              </Link>
              <Link
                href="/fornecedores/cadastrados"
                className={`flex items-center rounded-lg py-2 pl-9 pr-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white ${
                  pathname.startsWith("/fornecedores/cadastrados") ? `${navItemActive} rounded-lg` : ""
                }`}
              >
                Fornecedores Cadastrados
              </Link>
            </div>
          ) : null}
        </div>

        <div className="mb-1">
          <button type="button" className={navItemBase} onClick={() => setAnalisesOpen((o) => !o)} aria-expanded={analisesOpen}>
            <span className="mr-3 h-2 w-2 shrink-0 rounded-full bg-[#1F7A63]" />
            Análises
            <Chevron open={analisesOpen} />
          </button>
          {analisesOpen ? (
            <div className="mt-0.5 space-y-0.5 border-l border-white/10 ml-4 pl-3">
              <Link
                href="/analises/realizadas"
                className={`flex items-center rounded-lg py-2 pl-9 pr-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white ${
                  pathname.startsWith("/analises/realizadas") ? `${navItemActive} rounded-lg` : ""
                }`}
              >
                Análises Realizadas
              </Link>
              <Link
                href="/analises/nova"
                className={`flex items-center rounded-lg py-2 pl-9 pr-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white ${
                  pathname === "/analises/nova" ? `${navItemActive} rounded-lg` : ""
                }`}
              >
                Criar Nova Análise
              </Link>
            </div>
          ) : null}
        </div>

        <Link href="/classificacao" className={`${navItemBase} ${pathname.startsWith("/classificacao") ? navItemActive : ""}`}>
          <span className="mr-3 h-2 w-2 shrink-0 rounded-full bg-[#1F7A63]" />
          Classificação
        </Link>

        <Link href="/laudos" className={`${navItemBase} ${pathname.startsWith("/laudos") ? navItemActive : ""}`}>
          <span className="mr-3 h-2 w-2 shrink-0 rounded-full bg-[#1F7A63]" />
          Laudos
        </Link>

        <Link href="/usuarios" className={`${navItemBase} ${pathname.startsWith("/usuarios") ? navItemActive : ""}`}>
          <span className="mr-3 h-2 w-2 shrink-0 rounded-full bg-[#1F7A63]" />
          Utilizadores
        </Link>

        {isAdmin ? (
          <Link href="/configuracoes" className={`${navItemBase} ${pathname.startsWith("/configuracoes") ? navItemActive : ""}`}>
            <span className="mr-3 h-2 w-2 shrink-0 rounded-full bg-[#1F7A63]" />
            Configurações
          </Link>
        ) : null}
      </nav>

      <div className="shrink-0 space-y-3 border-t border-white/10 p-5">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-3">
            {userPhoto ? (
              <img
                src={userPhoto}
                alt=""
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 rounded-full border border-white/20 object-cover"
                referrerPolicy="no-referrer"
                decoding="async"
              />
            ) : (
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-[#1F7A63] text-sm font-bold text-white"
                aria-hidden
              >
                {userInitials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{userName}</p>
              {user?.email ? (
                <p className="truncate text-xs text-white/50" title={user.email}>
                  {user.email}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg className="h-4 w-4 shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {loggingOut ? "A sair…" : "Sair"}
        </button>
      </div>
      </div>
    </aside>
  );
}
