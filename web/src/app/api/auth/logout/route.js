import { apiError, clearSession } from "@/lib/server-auth";

export async function POST() {
  try {
    await clearSession();
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error, "Could not sign out.");
  }
}
