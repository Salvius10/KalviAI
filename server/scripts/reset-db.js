const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();

async function resetDatabase() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not configured");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const collections = Object.keys(mongoose.connection.collections);
  for (const collectionName of collections) {
    await mongoose.connection.collections[collectionName].deleteMany({});
  }

  await mongoose.disconnect();
  console.log(`Cleared collections: ${collections.join(", ") || "none"}`);
}

resetDatabase().catch(async (error) => {
  console.error("Failed to clear MongoDB data:", error.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
