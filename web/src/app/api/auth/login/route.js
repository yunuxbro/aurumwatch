import bcrypt from "bcryptjs";
import { getDatabase } from "@/lib/mongodb";
import { apiError, createSession, httpError } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const user = await (await getDatabase()).collection("users").findOne({ email });
    if (!user || typeof user.passwordHash !== "string" || !(await bcrypt.compare(password, user.passwordHash))) {
      throw httpError("Email or password is incorrect.", 401);
    }

    const publicUser = { id: user._id.toString(), email: user.email };
    await createSession(publicUser);
    return Response.json({ user: publicUser, profile: user.profile });
  } catch (error) {
    return apiError(error, "Could not sign in.");
  }
}
