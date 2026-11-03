import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import { apiError, getSessionUser, httpError } from "@/lib/server-auth";

export async function PATCH(request) {
  try {
    const session = await getSessionUser();
    if (!session) throw httpError("Sign in to update account settings.", 401);
    const body = await request.json();
    const values = {
      display_name: typeof body.display_name === "string" ? body.display_name.trim() : "",
      shop_name: typeof body.shop_name === "string" ? body.shop_name.trim() : "",
      phone: typeof body.phone === "string" ? body.phone.trim() : "",
      theme: body.theme,
    };
    if (values.display_name.length > 100 || values.shop_name.length > 120 || values.phone.length > 40) {
      throw httpError("Profile fields exceed their allowed length.", 400);
    }
    if (values.theme !== "light" && values.theme !== "dark") {
      throw httpError("Choose a supported theme.", 400);
    }
    const db = await getDatabase();
    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(session.id) },
      { $set: { "profile.display_name": values.display_name, "profile.shop_name": values.shop_name, "profile.phone": values.phone, "profile.theme": values.theme, updated_at: new Date() } },
    );
    if (result.matchedCount !== 1) throw httpError("Account not found.", 404);
    return Response.json({ profile: { ...values } });
  } catch (error) {
    return apiError(error, "Could not save account settings.");
  }
}
