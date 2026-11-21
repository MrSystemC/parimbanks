"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import "../auth.css";

function returnPath(): string {
  if (typeof window === "undefined") return "/";
  const value = new URLSearchParams(window.location.search).get("return_to") || "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/login") || value.startsWith("/setup")) return "/";
  return value;
}

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) { setError("Пароли не совпадают."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, username, password }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось создать аккаунт.");
      window.location.assign(returnPath());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось создать аккаунт.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-shell"><section className="auth-card">
    <div className="auth-brand"><span className="auth-brand-mark">п</span><span>Пар&apos;ИМБА&apos;нк</span></div>
    <div className="auth-eyebrow">Новый участник</div>
    <h1>Создайте свой доступ.</h1>
    <p>Регистрация открывает личный кабинет участника. Баланс начинается с нуля, а монеты выдаёт администрация по запросу.</p>
    <form className="auth-form" onSubmit={submit}>
      <label>Имя участника<input required maxLength={80} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Как к вам обращаться" /></label>
      <label>Логин<input required minLength={3} maxLength={32} autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="латиница или кириллица" /><small>От 3 до 32 символов. Логин используется для входа.</small></label>
      <label>Пароль<input required minLength={8} maxLength={128} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Не менее 8 символов" /></label>
      <label>Повторите пароль<input required minLength={8} maxLength={128} type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Введите пароль ещё раз" /></label>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="auth-submit" disabled={busy}>{busy ? "Создаём…" : "Создать аккаунт"}</button>
    </form>
    <div className="auth-links"><span className="auth-muted">Уже есть аккаунт?</span><Link href={`/login?return_to=${encodeURIComponent(returnPath())}`}>Войти</Link></div>
  </section></main>;
}
