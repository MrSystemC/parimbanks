"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import "../auth.css";

function returnPath(): string {
  if (typeof window === "undefined") return "/";
  const value = new URLSearchParams(window.location.search).get("return_to") || "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/login") || value.startsWith("/setup")) return "/";
  return value;
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ authenticated?: boolean; setupRequired?: boolean }>)
      .then((result) => {
        if (result.authenticated) window.location.assign(returnPath());
        setSetupRequired(Boolean(result.setupRequired));
      })
      .catch(() => undefined);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось войти.");
      window.location.assign(returnPath());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось войти.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-shell"><section className="auth-card">
    <div className="auth-brand"><span className="auth-brand-mark">п</span><span>Пар&apos;ИМБА&apos;нк</span></div>
    <div className="auth-eyebrow">Личный доступ</div>
    <h1>С возвращением.</h1>
    <p>Войдите в личный кабинет, чтобы видеть баланс, билеты, результаты и сообщения команды.</p>
    <form className="auth-form" onSubmit={submit}>
      <label>Логин<input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Например, mikle" /></label>
      <label>Пароль<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Введите пароль" /></label>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="auth-submit" disabled={busy}>{busy ? "Проверяем…" : "Войти"}</button>
    </form>
    <div className="auth-links"><span className="auth-muted">Нет аккаунта? <Link href={`/register?return_to=${encodeURIComponent(returnPath())}`}>Зарегистрироваться</Link></span>{setupRequired ? <Link href={`/setup?return_to=${encodeURIComponent(returnPath())}`}>Первичная настройка</Link> : <Link href="/">На главную</Link>}</div>
  </section></main>;
}
