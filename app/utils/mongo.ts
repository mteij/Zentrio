import { MongoClient } from "mongodb";

const MONGO_URI = Deno.env.get("MONGO_URI");
if (!MONGO_URI) {
  throw new Error("MONGO_URI is not defined in the environment variables.");
}

if (MONGO_URI.includes("<password>")) {
  throw new Error(
    "Your MONGO_URI contains the placeholder '<password>'. " +
      "Please replace it with your actual database user password.",
  );
}

try {
  const url = new URL(MONGO_URI);
  if (url.pathname === "/" || !url.pathname) {
    throw new Error(
      "Your MONGO_URI seems to be missing a database name. " +
        "It should look like: '...mongodb.net/<db-name>?...'",
    );
  }
} catch (e) {
  if (e instanceof TypeError) {
    throw new Error(`Invalid MONGO_URI format: ${e.message}`);
  }
  throw e;
}

const client = new MongoClient();
try {
  await client.connect(MONGO_URI);
} catch (e) {
  console.error(
    "Failed to connect to MongoDB. Please double-check your MONGO_URI and IP Whitelist settings in MongoDB Atlas.",
  );
  throw e;
}

console.log("MongoDB connected successfully.");

export const db = client.database();
