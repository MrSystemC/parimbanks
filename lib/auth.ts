import { cookies } from "next/headers";
import { env } from "cloudflare:workers";

export type AuthIdentity = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

type Row = Record<string, unknown>;

const SESSION_COOKIE = "parimbank_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 120_000;
const encoder = new TextEncoder();

function db(): D1Database {
  if (!env.DB) throw new AuthError("Хранилище ещё не подключено. Попробуйте позже.", 503);
  return env.DB;
}

export class AuthError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function base64ToBytes(value: string): Uint8Array {
  const raw = atob(value);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function digest(value: string): Promise<string> {
  const result = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToBase64(new Uint8Array(result));
}

async function hashPassword(password: string, salt: Uint8Array<ArrayBufferLike> = crypto.getRandomValues(new Uint8Array(16))): Promise<{ hash: string; salt: string }> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  // Cloudflare's Web Crypto typings use ArrayBuffer while Node's Uint8Array is
  // parameterized with ArrayBufferLike. The runtime accepts both representations.
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: PASSWORD_ITERATIONS, hash: "SHA-256" }, key, 256);
  return { hash: bytesToBase64(new Uint8Array(bits)), salt: bytesToBase64(salt) };
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a[index] ^ b[index];
  return result === 0;
}

async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const candidate = await hashPassword(password, base64ToBytes(salt));
  return sameBytes(base64ToBytes(candidate.hash), base64ToBytes(hash));
}

function normalizeUsername(value: unknown): string {
  if (typeof value !== "string") throw new AuthError("Введите логин.");
  const username = value.trim().toLowerCase();
  if (!/^[a-zа-яё][a-zа-яё0-9._-]{2,31}$/iu.test(username)) {
    throw new AuthError("Логин должен содержать от 3 до 32 символов и начинаться с буквы.");
  }
  return username;
}

function validatePassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 8 || value.length > 128) {
    throw new AuthError("Пароль должен содержать от 8 до 128 символов.");
  }
  return value;
}

function displayName(value: unknown, username: string): string {
  if (typeof value !== "string" || !value.trim()) return username;
  return value.trim().slice(0, 80);
}

function userId(): string {
  return `user_${crypto.randomUUID()}`;
}

function sessionToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
}

async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: import.meta.env.PROD, path: "/", maxAge: 0 });
}

async function createSession(id: string): Promise<void> {
  const raw = sessionToken();
  const tokenHash = await digest(raw);
  const timestamp = Date.now();
  await db().prepare("INSERT INTO auth_sessions (token_hash,user_id,created_at,last_seen_at,expires_at) VALUES (?,?,?,?,?)")
    .bind(tokenHash, id, timestamp, timestamp, timestamp + SESSION_TTL_MS).run();
  await setSessionCookie(raw);
}

export async function getAuthenticatedUser(): Promise<AuthIdentity | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const tokenHash = await digest(raw);
  const row = await db().prepare(`SELECT u.id,u.name,ac.username,u.status,asess.expires_at
    FROM auth_sessions asess JOIN users u ON u.id=asess.user_id
    JOIN auth_credentials ac ON ac.user_id=u.id
    WHERE asess.token_hash=?`).bind(tokenHash).first<Row>();
  // A blocked participant must still be able to read their history and contact
  // support. Operational restrictions are enforced by event-service actions.
  if (!row || Number(row.expires_at) <= Date.now()) return null;
  await db().prepare("UPDATE auth_sessions SET last_seen_at=? WHERE token_hash=?").bind(Date.now(), tokenHash).run();
  return { userId: String(row.id), displayName: String(row.name), email: String(row.username), fullName: String(row.name) };
}

export async function login(usernameValue: unknown, passwordValue: unknown): Promise<AuthIdentity> {
  const username = normalizeUsername(usernameValue);
  const password = validatePassword(passwordValue);
  const row = await db().prepare(`SELECT u.id,u.name,u.status,ac.password_hash,ac.password_salt,ac.username
    FROM auth_credentials ac JOIN users u ON u.id=ac.user_id WHERE ac.username=?`).bind(username).first<Row>();
  if (!row || row.status !== "active" || !(await verifyPassword(password, String(row.password_hash), String(row.password_salt)))) {
    throw new AuthError("Неверный логин или пароль.", 401);
  }
  await createSession(String(row.id));
  return { userId: String(row.id), displayName: String(row.name), email: String(row.username), fullName: String(row.name) };
}

export async function registerUser(input: Record<string, unknown>): Promise<AuthIdentity> {
  const username = normalizeUsername(input.username);
  const password = validatePassword(input.password);
  const name = displayName(input.name, username);
  const database = db();
  const existing = await database.prepare("SELECT user_id FROM auth_credentials WHERE username=?").bind(username).first<Row>();
  if (existing) throw new AuthError("Этот логин уже занят.", 409);
  const id = userId();
  const timestamp = Date.now();
  const credentials = await hashPassword(password);
  try {
    await database.batch([
      database.prepare("INSERT INTO users (id,name,balance,role,status,is_demo,created_at) VALUES (?,? ,0,'user','active',0,?)").bind(id, name, timestamp),
      database.prepare("INSERT INTO auth_credentials (user_id,username,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,?,?,?)").bind(id, username, credentials.hash, credentials.salt, timestamp, timestamp),
    ]);
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) throw new AuthError("Этот логин уже занят.", 409);
    throw error;
  }
  await createSession(id);
  return { userId: id, displayName: name, email: username, fullName: name };
}

export async function setupOwner(input: Record<string, unknown>): Promise<AuthIdentity> {
  const database = db();
  const username = normalizeUsername(input.username);
  const password = validatePassword(input.password);
  const name = displayName(input.name, username);
  const id = userId();
  const timestamp = Date.now();
  const credentials = await hashPassword(password);
  // The marker and credential inserts share one D1 transaction. This makes
  // first-run setup race-safe when two browser tabs submit at the same time.
  await database.batch([
    database.prepare("INSERT OR IGNORE INTO app_meta (key,value) VALUES ('auth_setup_v1','1')"),
    database.prepare("INSERT INTO users (id,name,balance,role,status,is_demo,created_at) SELECT ?,?,0,'owner','active',0,? WHERE NOT EXISTS (SELECT 1 FROM auth_credentials)").bind(id, name, timestamp),
    database.prepare("INSERT INTO auth_credentials (user_id,username,password_hash,password_salt,created_at,updated_at) SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM auth_credentials)").bind(id, username, credentials.hash, credentials.salt, timestamp, timestamp),
    database.prepare("INSERT OR IGNORE INTO app_meta (key,value) SELECT 'admin_user_id',user_id FROM auth_credentials WHERE user_id=?").bind(id),
    database.prepare("INSERT OR IGNORE INTO app_meta (key,value) SELECT 'owner_email_binding',username FROM auth_credentials WHERE user_id=?").bind(id),
  ]);
  const saved = await database.prepare("SELECT u.id,u.name,ac.username FROM auth_credentials ac JOIN users u ON u.id=ac.user_id WHERE ac.username=?").bind(username).first<Row>();
  if (!saved || String(saved.id) !== id) throw new AuthError("Первичная настройка уже завершена. Войдите в аккаунт администратора.", 409);
  await createSession(id);
  return { userId: id, displayName: String(saved.name), email: username, fullName: String(saved.name) };
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (raw) await db().prepare("DELETE FROM auth_sessions WHERE token_hash=?").bind(await digest(raw)).run();
  await clearSessionCookie();
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}
