import bcrypt from "bcryptjs";
import { getDatabase } from "@/lib/mongodb";
import { apiError, assertAuthConfig, createSession, httpError } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      throw httpError("Enter a valid email address.", 400);
    }
    if (password.length < 12 || password.length > 128) {
      throw httpError("Use a password between 12 and 128 characters.", 400);
    }
    if (displayName.length > 100) throw httpError("Your name must be 100 characters or fewer.", 400);
    assertAuthConfig();

    const db = await getDatabase();
    const users = db.collection("users");
    await users.createIndex({ email: 1 }, { unique: true });
    const existing = await users.findOne({ email }, { projection: { _id: 1 } });
    if (existing) throw httpError("An account with this email already exists. Sign in instead.", 409);

    const now = new Date();
    const user = {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      profile: {
        display_name: displayName,
        shop_name: "",
        phone: "",
        theme: "light",
        avatar_file_id: null,
      },
      created_at: now,
      updated_at: now,
    };
    const { insertedId } = await users.insertOne(user);
    const publicUser = { id: insertedId.toString(), email };
    await createSession(publicUser);
    return Response.json({ user: publicUser, profile: user.profile }, { status: 201 });
  } catch (error) {
    if (error?.code === 11000) {
      return Response.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 });
    }
    return apiError(error, "Could not create your account.");
  }
}
