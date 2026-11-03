import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import { deletePrivateFile, savePrivateFile } from "@/lib/private-files";
import { apiError, getSessionUser, httpError } from "@/lib/server-auth";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request) {
  try {
    const session = await getSessionUser();
    if (!session) throw httpError("Sign in to update your profile photo.", 401);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size > 5 * 1024 * 1024) {
      throw httpError("Choose a JPG, PNG, or WebP profile photo no larger than 5 MB.", 400);
    }

    const db = await getDatabase();
    const ownerId = new ObjectId(session.id);
    const user = await db.collection("users").findOne({ _id: ownerId }, { projection: { "profile.avatar_file_id": 1 } });
    if (!user) throw httpError("Account not found.", 404);
    const fileId = await savePrivateFile({
      ownerId: session.id,
      filename: file.name,
      contentType: file.type,
      buffer: Buffer.from(await file.arrayBuffer()),
      kind: "avatar",
    });
    await db.collection("users").updateOne(
      { _id: ownerId },
      { $set: { "profile.avatar_file_id": fileId, updated_at: new Date() } },
    );
    if (user.profile?.avatar_file_id) await deletePrivateFile(user.profile.avatar_file_id);
    return Response.json({ avatar_file_id: fileId });
  } catch (error) {
    return apiError(error, "Could not upload the profile photo.");
  }
}
