import { getAuthenticatedUser } from "@/lib/auth";
import { authErrorResponse } from "../helpers";
import { setupRequired } from "../helpers";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    return Response.json({ authenticated: !!user, user, setupRequired: await setupRequired() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return authErrorResponse(error);
  }
}
