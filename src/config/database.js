const mongoose = require("mongoose");

// MongoDB connection options for production
const connectionOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.error("⚠️ MONGODB_URI environment variable is not set");
    console.log("⚠️ Server running without database connection");
    return null;
  }

  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI,
      connectionOptions,
    );
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      console.error("⚠️ MongoDB connection error:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ MongoDB disconnected. Attempting to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("✅ MongoDB reconnected");
    });

    return conn;
  } catch (error) {
    console.error("⚠️ MongoDB connection error:", error.message);
    console.log("⚠️ Server running without database connection");
    return null;
  }
};

// Graceful shutdown handler
const closeDB = async () => {
  try {
    await mongoose.connection.close();
    console.log("✅ MongoDB connection closed");
  } catch (error) {
    console.error("Error closing MongoDB connection:", error.message);
  }
};

module.exports = { connectDB, closeDB };
