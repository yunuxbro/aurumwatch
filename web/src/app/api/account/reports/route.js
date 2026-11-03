import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import { deletePrivateFile, savePrivateFile } from "@/lib/private-files";
import { apiError, getSessionUser, httpError } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function POST(request) {
  let fileId;
  try {
    const session = await getSessionUser();
    if (!session) throw httpError("Sign in to save a report to your account.", 401);
    const form = await request.formData();
    const file = form.get("file");
    const summaryText = String(form.get("summary") || "{}");
    if (!(file instanceof File) || file.type !== "application/pdf" || file.size > 20 * 1024 * 1024) {
      throw httpError("Choose a PDF report no larger than 20 MB.", 400);
    }
    let summary;
    try {
      summary = JSON.parse(summaryText);
    } catch {
      throw httpError("The report summary is invalid.", 400);
    }
    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    if (pdfBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw httpError("The selected report is not a valid PDF.", 400);
    }
    const title = file.name.slice(0, 180) || "AurumWatch estimate.pdf";
    fileId = await savePrivateFile({
      ownerId: session.id,
      filename: title,
      contentType: "application/pdf",
      buffer: pdfBuffer,
      kind: "design_report",
    });
    const record = { ownerId: new ObjectId(session.id), title, file_id: fileId, summary, created_at: new Date() };
    const result = await (await getDatabase()).collection("reports").insertOne(record);
    return Response.json({ ...record, id: result.insertedId.toString(), ownerId: undefined }, { status: 201 });
  } catch (error) {
    if (fileId) {
      try {
        await deletePrivateFile(fileId);
      } catch (cleanupError) {
        console.error("Could not clean up an unsaved report.", cleanupError);
      }
    }
    return apiError(error, "Could not save the PDF report.");
  }
}
