import { MongoClient } from "mongodb";

const MONGO_USER = Deno.env.get("MONGO_USER");
const MONGO_PASSWORD = Deno.env.get("MONGO_PASSWORD");
const MONGO_CLUSTER_URL = Deno.env.get("MONGO_CLUSTER_URL");
const MONGO_DB_NAME = Deno.env.get("MONGO_DB_NAME");

if (!MONGO_USER || !MONGO_PASSWORD || !MONGO_CLUSTER_URL || !MONGO_DB_NAME) {
  throw new Error(
    "One or more MongoDB environment variables are not defined. " +
      "Please check MONGO_USER, MONGO_PASSWORD, MONGO_CLUSTER_URL, and MONGO_DB_NAME.",
  );
}

// Build the connection string programmatically to handle special characters
const MONGO_URI = `mongodb+srv://${encodeURIComponent(MONGO_USER)}:${
  encodeURIComponent(MONGO_PASSWORD)
}@${MONGO_CLUSTER_URL}/?authSource=${MONGO_DB_NAME}&retryWrites=true&w=majority`;

const client = new MongoClient();
try {
  await client.connect(MONGO_URI);
} catch (e) {
  console.error(
    "Failed to connect to MongoDB. Please double-check your credentials and IP Whitelist settings in MongoDB Atlas.",
  );
  throw e;
}

console.log("MongoDB connected successfully.");

export const db = client.database(MONGO_DB_NAME);
