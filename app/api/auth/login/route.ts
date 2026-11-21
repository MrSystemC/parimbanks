import { login } from "@/lib/auth";
import { authErrorResponse, requestBody } from "../helpers";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const body = await requestBody(request);
    const user = await login(body.username, body.password);
    return Response.json({ ok: true, user }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return authErrorResponse(error);
  }
}
