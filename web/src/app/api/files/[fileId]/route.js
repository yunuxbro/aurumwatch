import { ObjectId } from "mongodb";
import { findPrivateFile, fileResponse } from "@/lib/private-files";
import { apiError, getSessionUser, httpError } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function GET(_request, context) {
  try {
    const session = await getSessionUser();
    if (!session) throw httpError("Sign in to access private files.", 401);
    const { fileId } = await context.params;
    if (!ObjectId.isValid(fileId)) throw httpError("File not found.", 404);
    const result = await findPrivateFile(fileId, session.id);
    if (!result) throw httpError("File not found.", 404);
    const response = fileResponse(result.bucket, result.file);
    if (result.file.metadata?.kind === "avatar") {
      response.headers.set("Content-Disposition", "inline");
      response.headers.set("Cache-Control", "private, max-age=300");
    }
    return response;
  } catch (error) {
    return apiError(error, "Could not access the private file.");
  }
}
