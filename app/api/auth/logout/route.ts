import { logout } from "@/lib/auth";
import { authErrorResponse } from "../helpers";
function returnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://local.invalid");
    if (url.origin !== "https://local.invalid" || url.pathname.startsWith("/api/")) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
export const dynamic = "force-dynamic";
export async function POST() {
  try {
    await logout();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return authErrorResponse(error);
  }
}
export async function GET(request: Request) {
  try {
    await logout();
    return Response.redirect(new URL(returnPath(new URL(request.url).searchParams.get("return_to")), request.url), 303);
  } catch (error) {
    return authErrorResponse(error);
  }
}
