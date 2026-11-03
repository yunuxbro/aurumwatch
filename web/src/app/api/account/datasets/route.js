import { ObjectId } from "mongodb";
import { validateAccountCsv } from "@/lib/account-data";
import { getDatabase } from "@/lib/mongodb";
import { deletePrivateFile, savePrivateFile } from "@/lib/private-files";
import { apiError, getSessionUser, httpError } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function POST(request) {
  let fileId;
  try {
    const session = await getSessionUser();
    if (!session) throw httpError("Sign in to save a private dataset.", 401);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv") || file.size > 5 * 1024 * 1024) {
      throw httpError("Choose a CSV file no larger than 5 MB.", 400);
    }
    const text = await file.text();
    const validation = validateAccountCsv(text);
    if (!validation.accepted_rows) throw httpError("No valid rows to save. Correct the CSV and upload it again.", 400);

    fileId = await savePrivateFile({
      ownerId: session.id,
      filename: file.name,
      contentType: "text/csv",
      buffer: Buffer.from(text, "utf8"),
      kind: "dataset",
    });
    const record = {
      ownerId: new ObjectId(session.id),
      kind: validation.kind,
      file_name: file.name,
      file_id: fileId,
      records: validation.accepted,
      validation: {
        total_rows: validation.total_rows,
        accepted_rows: validation.accepted_rows,
        rejected_rows: validation.rejected_rows,
        rejected: validation.rejected,
      },
      created_at: new Date(),
    };
    const result = await (await getDatabase()).collection("datasets").insertOne(record);
    return Response.json({ ...record, records: undefined, id: result.insertedId.toString(), ownerId: undefined }, { status: 201 });
  } catch (error) {
    if (fileId) {
      try {
        await deletePrivateFile(fileId);
      } catch (cleanupError) {
        console.error("Could not clean up an unsaved dataset file.", cleanupError);
      }
    }
    return apiError(error, "Could not save the validated dataset.");
  }
}
