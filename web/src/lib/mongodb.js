import { MongoClient } from "mongodb";

const options = {};
let clientPromise;

function getClientPromise() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw Object.assign(
      new Error("MongoDB is not configured. Add MONGODB_URI to web/.env.local."),
      { status: 503 },
    );
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._aurumMongoClientPromise) {
      global._aurumMongoClientPromise = new MongoClient(uri, options).connect();
    }
    return global._aurumMongoClientPromise;
  }
  clientPromise ||= new MongoClient(uri, options).connect();
  return clientPromise;
}

export async function getDatabase() {
  const client = await getClientPromise();
  return client.db(process.env.MONGODB_DB || "aurumwatch");
}
