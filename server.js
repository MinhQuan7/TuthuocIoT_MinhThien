// Tủ Thuốc AIoT Server - Production Version
// Author: Tech Lead
// Version: 2.0.0 - Real Data Implementation

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const DataManager = require("./models/dataManager");
const EraIotClient = require("./utils/eraIotClient");
const AlertScheduler = require("./utils/alertScheduler");
const {
  validateScheduleData,
  validateUserData,
  validateMedicineData,
  sanitizeInput,
  isTimeForReminder,
  getPeriodTime,
} = require("./utils/helpers");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;

// Initialize DataManager, E-Ra IoT Client và AlertScheduler
const dataManager = new DataManager();
const eraIotClient = new EraIotClient();
const alertScheduler = new AlertScheduler(dataManager);

// Test E-Ra IoT connection on startup
eraIotClient
  .testConnection()
  .then((success) => {
    if (success) {
      console.log(" [E-Ra IoT] Connection established successfully");
    } else {
      console.warn(
        "⚠️ [E-Ra IoT] Connection test failed - IoT features may not work properly"
      );
      console.warn("   - Check internet connection and E-Ra server status");
      console.warn(
        "   - IoT alerts will be disabled until connection is restored"
      );
    }
  })
  .catch((error) => {
    console.error("❌ [E-Ra IoT] Connection test error:", error.message);
    console.warn(
      "   - IoT functionality will be limited until connection is restored"
    );
  });

// Middleware
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Cấu hình multer cho upload avatar
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "public/assets/downloads/profile");
    // Tạo thư mục nếu chưa tồn tại
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Tạo tên file duy nhất
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "avatar-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Chỉ cho phép file ảnh
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ cho phép tải lên file ảnh!"), false);
    }
  },
});

app.use(express.static("public"));
app.use(express.json());

console.log("Khởi động máy chủ Tủ Thuốc AIoT (Production Mode)...");

// Global variables
let connectedClients = new Set();

// Helper functions
const broadcastToAll = (event, data) => {
  io.emit(event, data);
};

const logAction = (action, details = "") => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${action}${details ? ": " + details : ""}`);
};

// Error handler
const handleError = (socket, error, context = "Unknown") => {
  console.error(`[Error in ${context}]:`, error);
  socket.emit("error", {
    message: error.message || "Đã xảy ra lỗi",
    context: context,
    timestamp: new Date().toISOString(),
  });
};

// === SOCKET.IO CONNECTION HANDLING ===
io.on("connection", async (socket) => {
  connectedClients.add(socket.id);
  logAction("Kết nối mới", `Client: ${socket.id}`);

  try {
    // 1. Send initial data on connection
    const data = await dataManager.loadData();
    console.log(`[InitialData] Sending data to client ${socket.id}:`, {
      users: data.users?.length || 0,
      medicines: data.medicines?.length || 0,
      schedules: data.schedules?.length || 0,
      alerts: data.alerts?.length || 0,
    });
    socket.emit("initialData", data);
    logAction(
      "Gửi dữ liệu ban đầu",
      `Client: ${socket.id} | Users: ${data.users?.length || 0} | Medicines: ${
        data.medicines?.length || 0
      }`
    );
  } catch (error) {
    handleError(socket, error, "Initial data load");
  }

  // === ESSENTIAL SOCKET EVENTS ONLY ===

  // 2. Handle new schedule creation with automatic alerts
  socket.on("saveNewSchedule", async (scheduleData) => {
    try {
      // Sanitize inputs
      const sanitizedData = {
        userId: parseInt(scheduleData.userId),
        weekdays: scheduleData.weekdays || [],
        period: sanitizeInput(scheduleData.period),
        customTime: scheduleData.customTime
          ? sanitizeInput(scheduleData.customTime)
          : null,
        usageDuration: parseInt(scheduleData.usageDuration),
        medicines: scheduleData.medicines || [],
        notes: sanitizeInput(scheduleData.notes),
      };

      logAction(
        "Tạo lịch mới với alert tự động",
        JSON.stringify(sanitizedData)
      );

      // Tạo các lịch cho từng thuốc và thứ trong tuần
      const createdSchedules = [];
      const startDate = new Date();
      const endDate = new Date(
        startDate.getTime() + sanitizedData.usageDuration * 24 * 60 * 60 * 1000
      );

      // Lặp qua từng ngày trong khoảng thời gian sử dụng
      for (
        let currentDate = new Date(startDate);
        currentDate <= endDate;
        currentDate.setDate(currentDate.getDate() + 1)
      ) {
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, ...

        // Kiểm tra xem ngày hiện tại có trong danh sách thứ được chọn không
        if (sanitizedData.weekdays.includes(dayOfWeek)) {
          // Tạo lịch cho từng thuốc
          for (const medicine of sanitizedData.medicines) {
            const scheduleItem = {
              userId: sanitizedData.userId,
              medicineId: null, // Sẽ được tạo medicine mới nếu cần
              medicineName: medicine.name,
              medicineCategory: medicine.category,
              date: currentDate.toISOString().split("T")[0],
              period: sanitizedData.period,
              customTime: sanitizedData.customTime,
              notes: sanitizedData.notes,
              usageDuration: sanitizedData.usageDuration,
              weekdays: sanitizedData.weekdays,
            };

            const newSchedule = await dataManager.addSchedule(scheduleItem);
            createdSchedules.push(newSchedule);
          }
        }
      }

      // Add schedules to AlertScheduler for automatic monitoring
      for (const schedule of createdSchedules) {
        await alertScheduler.addSchedule(schedule);
      }

      // Get updated schedules and broadcast
      const updatedData = await dataManager.loadData();
      broadcastToAll("scheduleUpdated", updatedData.schedules);

      socket.emit("actionResponse", {
        success: true,
        message: `Đã tạo thành công ${createdSchedules.length} lịch uống thuốc với alert tự động!`,
        data: createdSchedules,
        alertsScheduled: createdSchedules.length,
      });
    } catch (error) {
      handleError(socket, error, "Save schedule");
    }
  });

  // 3. Handle user management
  socket.on("saveNewUser", async (userData) => {
    try {
      const sanitizedData = {
        name: sanitizeInput(userData.name),
        avatars: userData.avatars || [],
        avatar:
          userData.avatars && userData.avatars.length > 0
            ? userData.avatars[0]
            : userData.avatar ||
              `https://i.pravatar.cc/150?img=${Date.now() % 70}`,
      };

      validateUserData(sanitizedData);
      logAction("Tạo người dùng mới", sanitizedData.name);

      const newUser = await dataManager.addUser(sanitizedData);
      const updatedData = await dataManager.loadData();
      broadcastToAll("userListUpdated", updatedData.users);

      socket.emit("actionResponse", {
        success: true,
        message: `Người dùng ${newUser.name} đã được thêm thành công!`,
        data: newUser,
      });
    } catch (error) {
      handleError(socket, error, "Save user");
    }
  });

  // 4. Handle user deletion
  socket.on("deleteUser", async (requestData) => {
    try {
      const userId = parseInt(requestData.id);
      logAction("Xóa người dùng", `ID: ${userId}`);

      await dataManager.deleteUser(userId);
      const updatedData = await dataManager.loadData();
      broadcastToAll("userListUpdated", updatedData.users);

      socket.emit("actionResponse", {
        success: true,
        message: "Người dùng đã được xóa thành công!",
      });
    } catch (error) {
      handleError(socket, error, "Delete user");
    }
  });

  // 5. Handle medicine management
  socket.on("saveNewMedicine", async (medicineData) => {
    try {
      const sanitizedData = {
        name: sanitizeInput(medicineData.name),
        dosage: sanitizeInput(medicineData.dosage),
        instructions: sanitizeInput(medicineData.instructions),
        sideEffects: sanitizeInput(medicineData.sideEffects),
        expiryDate: medicineData.expiryDate,
        quantity: parseInt(medicineData.quantity) || 0,
        minThreshold: parseInt(medicineData.minThreshold) || 5,
      };

      validateMedicineData(sanitizedData);
      logAction("Tạo thuốc mới", sanitizedData.name);

      const newMedicine = await dataManager.addMedicine(sanitizedData);
      const updatedData = await dataManager.loadData();
      broadcastToAll("medicinesUpdated", updatedData.medicines);

      socket.emit("actionResponse", {
        success: true,
        message: `Thuốc ${newMedicine.name} đã được thêm thành công!`,
        data: newMedicine,
      });
    } catch (error) {
      handleError(socket, error, "Save medicine");
    }
  });

  socket.on("disconnect", () => {
    connectedClients.delete(socket.id);
    logAction("Ngắt kết nối", `Client: ${socket.id}`);
  });
});

// === REAL-TIME REMINDER SYSTEM ===
const checkPendingReminders = async () => {
  try {
    const pendingReminders = await dataManager.getPendingReminders();

    for (const schedule of pendingReminders) {
      if (isTimeForReminder(schedule)) {
        const data = await dataManager.loadData();
        const user = data.users.find((u) => u.id === schedule.userId);
        const medicine = data.medicines.find(
          (m) => m.id === schedule.medicineId
        );

        if (user && medicine) {
          // Format period display text
          const periodDisplay =
            schedule.period === "custom" && schedule.customTime
              ? `${schedule.customTime}`
              : schedule.period;

          // Trigger E-Ra IoT device for automatic medication reminder
          const iotSuccess = await eraIotClient.sendMedicationReminder(45000); // 45 second alert for automatic reminders

          if (iotSuccess) {
            // Create success reminder alert
            await dataManager.addAlert({
              type: "success",
              message: `🔔 Đến giờ uống thuốc! ${user.name} cần uống ${medicine.name} (${medicine.dosage}) - ${periodDisplay}. Tủ thuốc đang phát cảnh báo LED + còi.`,
              priority: "high",
            });

            console.log(
              `[E-Ra IoT] Automatic medication reminder sent for ${user.name} - ${medicine.name}`
            );
          } else {
            // Create warning if IoT failed but still notify
            await dataManager.addAlert({
              type: "warning",
              message: `⏰ Đến giờ uống thuốc! ${user.name} cần uống ${medicine.name} (${medicine.dosage}) - ${periodDisplay}. ⚠️ Lỗi kết nối tủ thuốc IoT!`,
              priority: "high",
            });

            console.warn(
              `[E-Ra IoT] Failed to send automatic reminder for ${user.name} - ${medicine.name}`
            );
          }

          // Broadcast reminder to all clients
          const updatedData = await dataManager.loadData();
          broadcastToAll("reminderAlert", {
            schedule: schedule,
            user: user,
            medicine: medicine,
            message: `Đến giờ uống thuốc cho ${user.name}!`,
            iotTriggered: iotSuccess,
          });

          broadcastToAll("alertsUpdated", updatedData.alerts);

          logAction(
            "Tự động nhắc nhở",
            `${user.name} - ${medicine.name} - ${periodDisplay} - IoT: ${
              iotSuccess ? "Success" : "Failed"
            }`
          );
        }
      }
    }
  } catch (error) {
    console.error("[Reminder System Error]:", error);
  }
};

// === SYSTEM HEALTH MONITORING ===
const monitorSystemHealth = async () => {
  try {
    const data = await dataManager.loadData();

    // Check for low medicine stock
    for (const medicine of data.medicines) {
      if (medicine.quantity <= medicine.minThreshold) {
        await dataManager.addAlert({
          type: "danger",
          message: `⚠️ Thuốc ${medicine.name} sắp hết! Còn lại ${medicine.quantity} viên`,
          priority: "high",
        });
      }
    }

    // Check for expired medicines
    const today = new Date();
    for (const medicine of data.medicines) {
      if (medicine.expiryDate) {
        const expiryDate = new Date(medicine.expiryDate);
        const daysToExpiry = Math.ceil(
          (expiryDate - today) / (1000 * 60 * 60 * 24)
        );

        if (daysToExpiry <= 7 && daysToExpiry > 0) {
          await dataManager.addAlert({
            type: "warning",
            message: `📅 Thuốc ${medicine.name} sẽ hết hạn trong ${daysToExpiry} ngày`,
            priority: "medium",
          });
        } else if (daysToExpiry <= 0) {
          await dataManager.addAlert({
            type: "danger",
            message: `🚫 Thuốc ${medicine.name} đã hết hạn sử dụng!`,
            priority: "high",
          });
        }
      }
    }

    // Broadcast updated alerts
    const updatedData = await dataManager.loadData();
    broadcastToAll("alertsUpdated", updatedData.alerts);
  } catch (error) {
    console.error("[System Health Error]:", error);
  }
};

// === SCHEDULED TASKS ===
// Check for reminders every minute
setInterval(checkPendingReminders, 60000);

// Monitor system health every 30 minutes
setInterval(monitorSystemHealth, 30 * 60000);

// Initial health check on startup
setTimeout(monitorSystemHealth, 5000);

// === REST API ENDPOINTS ===
// Route upload avatars
app.post("/api/upload-avatars", upload.array("avatars", 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Không có file nào được tải lên",
      });
    }

    const filePaths = req.files.map(
      (file) => `/assets/downloads/profile/${file.filename}`
    );

    res.json({
      success: true,
      message: "Ảnh đã được tải lên thành công",
      filePaths: filePaths,
    });

    logAction("Upload avatars", `Count: ${req.files.length}`);
  } catch (error) {
    console.error("Lỗi upload avatar:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi tải ảnh",
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    connectedClients: connectedClients.size,
    uptime: process.uptime(),
  });
});

app.get("/api/data", async (req, res) => {
  try {
    const data = await dataManager.loadData();
    res.json({
      success: true,
      data: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// API để monitor alert scheduler status
app.get("/api/alerts/status", (req, res) => {
  try {
    const status = alertScheduler.getStatus();
    res.json({
      success: true,
      alertScheduler: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// API for Raspberry Pi to sync user images
app.get("/api/users/images", async (req, res) => {
  try {
    const data = await dataManager.loadData();
    const users = data.users.map((u) => ({
      id: u.id,
      name: u.name,
      avatars: u.avatars || (u.avatar ? [u.avatar] : []),
    }));
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API for Raspberry Pi to confirm check-in
app.post("/api/checkin/confirm", async (req, res) => {
  try {
    const { userId } = req.body;
    const data = await dataManager.loadData();
    const user = data.users.find((u) => String(u.id) === String(userId));

    if (user) {
      const message = `✅ Đã xác nhận: ${user.name} đã đến uống thuốc!`;

      // Add alert
      await dataManager.addAlert({
        type: "success",
        message: message,
        priority: "high",
      });

      // Broadcast update
      const updatedData = await dataManager.loadData();
      broadcastToAll("alertsUpdated", updatedData.alerts);

      // Notify clients specifically about check-in
      broadcastToAll("checkinConfirmed", {
        userId: user.id,
        userName: user.name,
        timestamp: new Date().toISOString(),
      });

      logAction("Check-in Confirmed", user.name);
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === ERROR HANDLING ===
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
});

// === GRACEFUL SHUTDOWN ===
process.on("SIGTERM", async () => {
  console.log("📴 Đang tắt server...");

  // Cleanup AlertScheduler
  if (alertScheduler) {
    alertScheduler.cleanup();
  }

  server.close(() => {
    console.log("✅ Server đã tắt thành công");
    process.exit(0);
  });
});

// === START SERVER ===
server.listen(PORT, async () => {
  console.log(` Tủ Thuốc AIoT Server đang chạy tại http://localhost:${PORT}`);
  console.log(` Connected clients: ${connectedClients.size}`);
  console.log(` System ready for medicine management`);

  // Initialize data on startup và verify data
  try {
    const initialData = await dataManager.loadData();
    console.log("📊 Dữ liệu hệ thống đã được khởi tạo:");
    console.log(`   👥 Users: ${initialData.users?.length || 0}`);
    console.log(`   💊 Medicines: ${initialData.medicines?.length || 0}`);
    console.log(`   📅 Schedules: ${initialData.schedules?.length || 0}`);
    console.log(`   🚨 Alerts: ${initialData.alerts?.length || 0}`);

    // Log user details if any exist
    if (initialData.users && initialData.users.length > 0) {
      console.log("👥 Existing users:");
      initialData.users.forEach((user, index) => {
        console.log(
          `   ${index + 1}. ${user.name} (ID: ${user.id}) - Created: ${
            user.createdAt
          }`
        );
      });
    }

    // Initialize AlertScheduler
    console.log("🔔 Initializing automatic alert system...");
    await alertScheduler.initialize();
    const schedulerStatus = alertScheduler.getStatus();
    console.log(
      `📋 AlertScheduler: ${schedulerStatus.activeAlerts} active alerts scheduled`
    );

    console.log("✅ Server initialization completed successfully!");
  } catch (error) {
    console.error("❌ Lỗi khởi tạo dữ liệu:", error);
  }
});
