"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import "../auth.css";

function returnPath(): string {
  if (typeof window === "undefined") return "/admin";
  const value = new URLSearchParams(window.location.search).get("return_to") || "/admin";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/login") || value.startsWith("/setup")) return "/admin";
  return value;
}

export default function SetupPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ authenticated?: boolean; setupRequired?: boolean }>)
      .then((result) => {
        if (result.authenticated) window.location.assign(returnPath());
        setAvailable(Boolean(result.setupRequired));
      })
      .catch(() => setError("Не удалось проверить состояние установки."))
      .finally(() => setChecking(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) { setError("Пароли не совпадают."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, username, password }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Первичная настройка не выполнена.");
      window.location.assign(returnPath());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Первичная настройка не выполнена.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-shell"><section className="auth-card">
    <div className="auth-brand"><span className="auth-brand-mark">п</span><span>Пар&apos;ИМБА&apos;нк</span></div>
    <div className="auth-eyebrow">Первый запуск проекта</div>
    <h1>Создайте аккаунт владельца.</h1>
    <p>Этот аккаунт получит полный доступ к админ-панели, настройкам проекта, пользователям, монетам и розыгрышам.</p>
    {checking ? <div className="auth-status">Проверяем, завершена ли первичная настройка…</div> : available ? <form className="auth-form" onSubmit={submit}>
      <label>Имя владельца<input required maxLength={80} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, Mikle" /></label>
      <label>Логин владельца<input required minLength={3} maxLength={32} autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="admin" /><small>Сохраните логин в менеджере паролей.</small></label>
      <label>Пароль<input required minLength={8} maxLength={128} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Не менее 8 символов" /></label>
      <label>Повторите пароль<input required minLength={8} maxLength={128} type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Введите пароль ещё раз" /></label>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="auth-submit" disabled={busy}>{busy ? "Создаём владельца…" : "Создать аккаунт владельца"}</button>
    </form> : <div className="auth-status">Первичная настройка уже выполнена. Войдите под аккаунтом владельца.</div>}
    <div className="auth-links"><Link href="/login">Вернуться ко входу</Link><Link href="/">На главную</Link></div>
  </section></main>;
}
