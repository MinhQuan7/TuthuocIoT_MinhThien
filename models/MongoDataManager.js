const mongoose = require("mongoose");
const DataManager = require("./dataManager");

// Define a flexible schema that can store any structure
// This mimics the JSON file behavior
const SystemDataSchema = new mongoose.Schema(
  {
    key: { type: String, default: "main_system_data", unique: true },
    data: { type: mongoose.Schema.Types.Mixed },
  },
  { strict: false, timestamps: true }
);

const SystemData = mongoose.model("SystemData", SystemDataSchema);

class MongoDataManager extends DataManager {
  constructor() {
    super();
    this.isConnected = false;
    this.connect();
  }

  async connect() {
    if (this.isConnected) return;

    try {
      if (!process.env.MONGODB_URI) {
        console.warn(
          "[MongoDataManager] MONGODB_URI not found in environment variables."
        );
        return;
      }

      // Add connection options for better stability
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
        socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      });

      this.isConnected = true;
      console.log("[MongoDataManager] Connected to MongoDB Atlas successfully");

      // Handle connection events
      mongoose.connection.on("error", (err) => {
        console.error("[MongoDataManager] Runtime connection error:", err);
        this.isConnected = false;
      });

      mongoose.connection.on("disconnected", () => {
        console.warn("[MongoDataManager] Disconnected from MongoDB");
        this.isConnected = false;
      });
    } catch (error) {
      console.error("[MongoDataManager] MongoDB connection error:", error);
      this.isConnected = false;
    }
  }

  async loadData() {
    try {
      if (!this.isConnected) await this.connect();

      // Try to find the data document
      let doc = await SystemData.findOne({ key: "main_system_data" });

      if (!doc) {
        console.log(
          "[MongoDataManager] No data found in MongoDB, initializing from default..."
        );
        // If not found, load default data (or from file if we want to migrate)
        // Here we just use the default structure from the parent class
        const defaultData = this.getDefaultData();

        // Create the initial document
        doc = await SystemData.create({
          key: "main_system_data",
          data: defaultData,
        });

        return defaultData;
      }

      // Return the data part of the document
      // We need to merge with defaults to ensure new fields are present (schema evolution)
      const defaultData = this.getDefaultData();
      const mergedData = this.mergeWithDefaults(doc.data, defaultData);

      return mergedData;
    } catch (error) {
      console.error("[MongoDataManager] Error loading data:", error);
      // Fallback to default data in memory if DB fails
      return this.getDefaultData();
    }
  }

  async saveData(data) {
    try {
      if (!this.isConnected) await this.connect();

      // Recalculate statistics (logic from parent class)
      this.recalculateStatistics(data);

      // Update metadata
      data.metadata.lastUpdate = new Date().toISOString();

      // Update the document in MongoDB
      await SystemData.findOneAndUpdate(
        { key: "main_system_data" },
        { data: data },
        { upsert: true, new: true }
      );

      console.log("[MongoDataManager] Data saved to MongoDB successfully");
      return true;
    } catch (error) {
      console.error("[MongoDataManager] Error saving data:", error);
      throw error;
    }
  }
}

module.exports = MongoDataManager;
