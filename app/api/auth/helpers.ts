import { env } from "cloudflare:workers";
import { AuthError } from "@/lib/auth";

export async function requestBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AuthError("Некорректные данные запроса.");
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError("Передайте данные в формате JSON.");
  }
}

export function authErrorResponse(error: unknown): Response {
  const status = error instanceof AuthError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Ошибка сервера.";
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function setupRequired(): Promise<boolean> {
  if (!env.DB) return false;
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM auth_credentials").first<{ count: number }>();
  return Number(row?.count || 0) === 0;
}
