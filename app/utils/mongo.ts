import mongoose from "mongoose";

let conn: Promise<typeof mongoose> | null = null;

const connect = () => {
  if (conn) {
    return conn;
  }

  const MONGO_URI = Deno.env.get("MONGO_URI");
  if (!MONGO_URI) {
    throw new Error("MONGO_URI environment variable is not defined.");
  }

  conn = mongoose
    .connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000, // Keep the timeout
    })
    .then((mongooseInstance) => {
      console.log("Mongoose connected successfully.");
      return mongooseInstance;
    })
    .catch((e) => {
      console.error(
        "Failed to connect to MongoDB. Please double-check your connection string (MONGO_URI) and IP Whitelist settings in MongoDB Atlas.",
      );
      console.error("Mongoose connection error:", e);
      // Set conn to null so a retry can be attempted if the app logic allows for it.
      conn = null;
      throw e; // Re-throw the error to crash the app on startup if the connection fails.
    });

  return conn;
};

// Export the promise. Any file that imports this and awaits it will wait for the connection.
export const db = connect();