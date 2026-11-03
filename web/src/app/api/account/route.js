import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import { apiError, getSessionUser, httpError } from "@/lib/server-auth";

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) throw httpError("Not signed in.", 401);
    const db = await getDatabase();
    const ownerId = new ObjectId(session.id);
    const [user, projects, datasets, reports] = await Promise.all([
      db.collection("users").findOne({ _id: ownerId }, { projection: { email: 1, profile: 1 } }),
      db.collection("projects").find({ ownerId }).sort({ created_at: -1 }).toArray(),
      db.collection("datasets").find({ ownerId }).sort({ created_at: -1 }).toArray(),
      db.collection("reports").find({ ownerId }).sort({ created_at: -1 }).toArray(),
    ]);
    if (!user) throw httpError("Account not found.", 401);

    const publicRecord = (record) => ({ ...record, id: record._id.toString(), _id: undefined, ownerId: undefined });
    return Response.json({
      user: { id: user._id.toString(), email: user.email },
      profile: user.profile,
      projects: projects.map(publicRecord),
      datasets: datasets.map(publicRecord),
      reports: reports.map(publicRecord),
    });
  } catch (error) {
    return apiError(error, "Could not load account data.");
  }
}
