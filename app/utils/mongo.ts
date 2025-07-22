import mongoose from "mongoose";

console.log("--- Executing mongo.ts ---");

const MONGO_URI = Deno.env.get("MONGO_URI");

if (!MONGO_URI) {
  console.error("MONGO_URI environment variable is not defined.");
  throw new Error("MONGO_URI environment variable is not defined.");
} else {
  console.log("MONGO_URI found.");
}

try {
  await mongoose.connect(MONGO_URI);
  console.log("Mongoose connected successfully.");
} catch (e) {
  console.error(
    "Failed to connect to MongoDB using Mongoose. Please double-check your connection string (MONGO_URI) and IP Whitelist settings in MongoDB Atlas.",
  );
  console.error("Mongoose connection error:", e);
  throw e;
}