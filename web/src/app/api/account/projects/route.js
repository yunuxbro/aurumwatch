import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import { deletePrivateFile, savePrivateFile } from "@/lib/private-files";
import { apiError, getSessionUser, httpError } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function POST(request) {
  let modelFileId;
  try {
    const session = await getSessionUser();
    if (!session) throw httpError("Sign in to save a jewelry project.", 401);
    const form = await request.formData();
    const name = String(form.get("name") || "").trim();
    const karat = Number(form.get("karat"));
    const goldWeight = Number(form.get("gold_weight_g"));
    const budget = Number(form.get("budget_lkr") || 0);
    const notes = String(form.get("notes") || "").trim();
    const model = form.get("model");
    const estimateText = String(form.get("estimate") || "{}");
    if (!name || name.length > 120 || ![18, 22, 24].includes(karat) ||
      !Number.isFinite(goldWeight) || goldWeight <= 0 ||
      !Number.isFinite(budget) || budget < 0 || notes.length > 1000) {
      throw httpError("Enter a valid project name, karat, positive gold weight, and non-negative budget.", 400);
    }
    let estimate;
    try {
      estimate = JSON.parse(estimateText);
    } catch {
      throw httpError("The project estimate is invalid.", 400);
    }
    if (model instanceof File) {
      if (model.size > 50 * 1024 * 1024) throw httpError("The CAD file exceeds the 50 MB limit.", 400);
      modelFileId = await savePrivateFile({
        ownerId: session.id,
        filename: model.name,
        contentType: model.type || "application/octet-stream",
        buffer: Buffer.from(await model.arrayBuffer()),
        kind: "jewelry_model",
      });
    }

    const record = {
      ownerId: new ObjectId(session.id),
      name,
      karat,
      gold_weight_g: goldWeight,
      budget_lkr: budget,
      notes,
      estimate,
      model_file_id: modelFileId || null,
      created_at: new Date(),
    };
    const result = await (await getDatabase()).collection("projects").insertOne(record);
    return Response.json({ ...record, id: result.insertedId.toString(), ownerId: undefined }, { status: 201 });
  } catch (error) {
    if (modelFileId) {
      try {
        await deletePrivateFile(modelFileId);
      } catch (cleanupError) {
        console.error("Could not clean up an unsaved jewelry model.", cleanupError);
      }
    }
    return apiError(error, "Could not save the jewelry project.");
  }
}
