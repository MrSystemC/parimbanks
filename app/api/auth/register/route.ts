import { registerUser } from "@/lib/auth";
import { authErrorResponse, requestBody, setupRequired } from "../helpers";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    if (await setupRequired()) return Response.json({ error: "Сначала создайте аккаунт владельца через первичную настройку." }, { status: 409 });
    const body = await requestBody(request);
    const user = await registerUser({ username: body.username, password: body.password, name: body.name });
    return Response.json({ ok: true, user }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return authErrorResponse(error);
  }
}
