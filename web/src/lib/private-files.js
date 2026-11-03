import { Readable } from "node:stream";
import { GridFSBucket, ObjectId } from "mongodb";
import { getDatabase } from "./mongodb.js";

export async function savePrivateFile({ ownerId, filename, contentType, buffer, kind }) {
  const db = await getDatabase();
  const bucket = new GridFSBucket(db, { bucketName: "privateFiles" });
  const upload = bucket.openUploadStream(filename, {
    contentType,
    metadata: { ownerId, kind },
  });

  await new Promise((resolve, reject) => {
    Readable.from(buffer)
      .pipe(upload)
      .once("error", reject)
      .once("finish", resolve);
  });
  return upload.id.toString();
}

export async function deletePrivateFile(fileId) {
  const bucket = new GridFSBucket(await getDatabase(), { bucketName: "privateFiles" });
  await bucket.delete(new ObjectId(fileId));
}

export async function findPrivateFile(fileId, ownerId) {
  const db = await getDatabase();
  const bucket = new GridFSBucket(db, { bucketName: "privateFiles" });
  const file = await db.collection("privateFiles.files").findOne({
    _id: new ObjectId(fileId),
    "metadata.ownerId": ownerId,
  });
  return file ? { bucket, file } : null;
}

export function fileResponse(bucket, file) {
  const stream = bucket.openDownloadStream(file._id);
  return new Response(Readable.toWeb(stream), {
    headers: {
      "Content-Type": file.contentType || "application/octet-stream",
      "Content-Length": String(file.length),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
