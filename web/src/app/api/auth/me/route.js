import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import { apiError, getSessionUser, httpError } from "@/lib/server-auth";

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) throw httpError("Not signed in.", 401);
    const user = await (await getDatabase()).collection("users").findOne(
      { _id: new ObjectId(session.id) },
      { projection: { email: 1, profile: 1 } },
    );
    if (!user) throw httpError("Account not found.", 401);
    return Response.json({
      user: { id: user._id.toString(), email: user.email },
      profile: user.profile,
    });
  } catch (error) {
    return apiError(error, "Could not check the current sign-in.");
  }
}
