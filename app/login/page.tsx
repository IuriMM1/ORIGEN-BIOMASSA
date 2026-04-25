"use client";

import Image from "next/image";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

const primaryDark = "#143328";
const limeGreen = "#8BC34A";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [regName, setRegName] = useState("");
  const [regJob, setRegJob] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regCompany, setRegCompany] = useState("");
  const [regRole, setRegRole] = useState<"usuario" | "admin">("usuario");
  const [regPassword, setRegPassword] = useState("");
  const [regPassword2, setRegPassword2] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regMessage, setRegMessage] = useState<string | null>(null);
  const [regError, setRegError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signError) {
      setError(
        signError.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : signError.message,
      );
      return;
    }
    // Dashboard (rota inicial `/` em `app/(dashboard)/page.tsx`) — navegação completa para aplicar a sessão de forma fiável
    window.location.assign("/");
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError(null);
    setRegMessage(null);
    if (regPassword.length < 6) {
      setRegError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (regPassword !== regPassword2) {
      setRegError("As senhas não coincidem.");
      return;
    }
    if (!regName.trim() || !regEmail.trim()) {
      setRegError("Nome e e-mail são obrigatórios.");
      return;
    }

    setRegLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: regEmail.trim(),
      password: regPassword,
      options: {
        data: {
          full_name: regName.trim(),
          job_title: regJob.trim() || null,
          phone: regPhone.trim() || null,
          company: regCompany.trim() || null,
          role: regRole,
        },
      },
    });
    setRegLoading(false);

    if (signUpError) {
      setRegError(signUpError.message);
      return;
    }

    if (data.user && !data.session) {
      setRegMessage(
        "Conta criada. Verifique o seu e-mail para confirmar o registo antes de iniciar sessão, se a confirmação estiver ativa no projeto.",
      );
    } else if (data.session) {
      setRegMessage("Conta criada. A iniciar sessão…");
      window.location.assign("/");
      return;
    } else {
      setRegMessage("Registo enviado. Pode tentar iniciar sessão com o e-mail e a senha indicados.");
    }

    setRegName("");
    setRegJob("");
    setRegPhone("");
    setRegEmail("");
    setRegCompany("");
    setRegRole("usuario");
    setRegPassword("");
    setRegPassword2("");
  }

  return (
    <div className="relative min-h-dvh min-h-screen w-full overflow-x-hidden bg-[#0c1210]">
      {/* Fundo fullscreen (viewport inteiro, imagem a preencher o ecrã) */}
      <div className="pointer-events-none fixed inset-0 z-0 w-full">
        <Image
          src="/login-image-2.png"
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
      </div>

      <div className="relative z-10 flex min-h-dvh min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <div className="flex w-full max-w-md flex-col gap-5">
          {/* Balão de acesso */}
          <div
            className="rounded-[1.75rem] border border-white/25 bg-white/95 p-8 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-9"
            style={{ boxShadow: `0 24px 60px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)` }}
          >
            <h1 className="text-center text-lg font-bold tracking-tight" style={{ color: primaryDark }}>
              Acesso à plataforma
            </h1>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {error ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-700" role="alert">
                  {error}
                </p>
              ) : null}

              <div>
                <label htmlFor="email" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                  E-mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="nome@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white py-3 px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#143328] focus:ring-2 focus:ring-[#143328]/20"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-4 pr-12 text-sm text-gray-900 outline-none transition focus:border-[#143328] focus:ring-2 focus:ring-[#143328]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100"
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105 disabled:opacity-60"
                style={{ backgroundColor: primaryDark }}
              >
                {loading ? "A entrar…" : "Entrar"}
              </button>
            </form>
          </div>

          {/* Balão cadastrar utilizador */}
          <div
            className="rounded-[1.75rem] border border-white/25 bg-white/95 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.45)] backdrop-blur-sm"
            style={{ boxShadow: `0 24px 60px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)` }}
          >
            <button
              type="button"
              onClick={() => {
                setRegisterOpen((o) => !o);
                setRegError(null);
                setRegMessage(null);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-[1.75rem] px-8 py-5 text-left transition hover:bg-white/60 sm:px-9"
              aria-expanded={registerOpen}
            >
              <span className="text-base font-bold" style={{ color: primaryDark }}>
                Cadastrar utilizador
              </span>
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: limeGreen, color: primaryDark }}
              >
                <svg className={`h-5 w-5 transition ${registerOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>

            {registerOpen ? (
              <div className="border-t border-gray-100 px-8 pb-8 pt-2 sm:px-9">
                <p className="mb-4 text-sm text-gray-950">
                  Preencha os dados para criar uma conta. O grau de acesso define o que pode ver na plataforma.
                </p>
                <form className="space-y-3.5" onSubmit={handleRegister}>
                  {regError ? (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                      {regError}
                    </p>
                  ) : null}
                  {regMessage ? (
                    <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
                      {regMessage}
                    </p>
                  ) : null}

                  <input
                    required
                    placeholder="Nome completo"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm text-black placeholder:text-black outline-none focus:border-[#143328] focus:ring-2 focus:ring-[#143328]/15"
                  />
                  <input
                    placeholder="Cargo"
                    value={regJob}
                    onChange={(e) => setRegJob(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm text-black placeholder:text-black outline-none focus:border-[#143328] focus:ring-2 focus:ring-[#143328]/15"
                  />
                  <input
                    placeholder="Celular"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm text-black placeholder:text-black outline-none focus:border-[#143328] focus:ring-2 focus:ring-[#143328]/15"
                  />
                  <input
                    required
                    type="email"
                    placeholder="E-mail"
                    autoComplete="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm text-black placeholder:text-black outline-none focus:border-[#143328] focus:ring-2 focus:ring-[#143328]/15"
                  />
                  <input
                    placeholder="Empresa"
                    value={regCompany}
                    onChange={(e) => setRegCompany(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm text-black placeholder:text-black outline-none focus:border-[#143328] focus:ring-2 focus:ring-[#143328]/15"
                  />

                  <div>
                    <label htmlFor="reg-role" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-black">
                      Grau de acesso
                    </label>
                    <select
                      id="reg-role"
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value as "usuario" | "admin")}
                      className="w-full rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm text-black outline-none focus:border-[#143328] focus:ring-2 focus:ring-[#143328]/15"
                    >
                      <option value="usuario" className="text-black">
                        Utilizador (sem Configurações)
                      </option>
                      <option value="admin" className="text-black">
                        Administrador (acesso total)
                      </option>
                    </select>
                  </div>

                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    placeholder="Senha (mín. 6 caracteres)"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm text-black placeholder:text-black outline-none focus:border-[#143328] focus:ring-2 focus:ring-[#143328]/15"
                  />
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirmar senha"
                    value={regPassword2}
                    onChange={(e) => setRegPassword2(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm text-black placeholder:text-black outline-none focus:border-[#143328] focus:ring-2 focus:ring-[#143328]/15"
                  />

                  <button
                    type="submit"
                    disabled={regLoading}
                    className="mt-2 w-full rounded-xl py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-105 disabled:opacity-60"
                    style={{ backgroundColor: primaryDark }}
                  >
                    {regLoading ? "A registar…" : "Criar conta"}
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
