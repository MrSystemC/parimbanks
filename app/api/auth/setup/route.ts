import { setupOwner } from "@/lib/auth";
import { authErrorResponse, requestBody } from "../helpers";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const body = await requestBody(request);
    const user = await setupOwner({ username: body.username, password: body.password, name: body.name });
    return Response.json({ ok: true, user }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return authErrorResponse(error);
  }
}
