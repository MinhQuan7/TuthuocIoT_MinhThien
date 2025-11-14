// Tủ Thuốc AIoT Server - Production Version
// Author: Tech Lead
// Version: 2.0.0 - Real Data Implementation

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const DataManager = require("./models/dataManager");
const EraIotClient = require("./utils/eraIotClient");
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

// Initialize DataManager and E-Ra IoT Client
const dataManager = new DataManager();
const eraIotClient = new EraIotClient();

// Test E-Ra IoT connection on startup
eraIotClient
  .testConnection()
  .then((success) => {
    if (success) {
      console.log("✅ [E-Ra IoT] Connection established successfully");
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

console.log("🚀 Khởi động máy chủ Tủ Thuốc AIoT (Production Mode)...");

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
    socket.emit("initialData", data);
    logAction("Gửi dữ liệu ban đầu", `Client: ${socket.id}`);
  } catch (error) {
    handleError(socket, error, "Initial data load");
  }

  // 2. Handle reminder requests
  socket.on("sendReminder", async (requestData) => {
    try {
      logAction("Yêu cầu nhắc nhở", `User: ${requestData.user}`);

      // Trigger E-Ra IoT device to turn on LED and buzzer
      const iotSuccess = await eraIotClient.sendMedicationReminder(30000); // 30 second alert

      if (iotSuccess) {
        socket.emit("actionResponse", {
          success: true,
          message: `Đã gửi lệnh nhắc nhở tới tủ thuốc cho ${requestData.user}! LED và còi đã được kích hoạt.`,
          timestamp: new Date().toISOString(),
        });

        // Add success alert
        await dataManager.addAlert({
          type: "success",
          message: `✅ Đã gửi nhắc nhở IoT thành công cho ${requestData.user} - LED và còi đang hoạt động`,
          priority: "normal",
        });
      } else {
        socket.emit("actionResponse", {
          success: false,
          message: `Lỗi kết nối tủ thuốc! Không thể gửi nhắc nhở cho ${requestData.user}. Vui lòng kiểm tra kết nối mạng và thử lại.`,
          timestamp: new Date().toISOString(),
        });

        // Add error alert
        await dataManager.addAlert({
          type: "warning",
          message: `⚠️ Lỗi kết nối E-Ra IoT! Không thể gửi nhắc nhở cho ${requestData.user}. Hệ thống sẽ thử kết nối lại.`,
          priority: "high",
        });
      }

      // Broadcast updated alerts
      const updatedData = await dataManager.loadData();
      broadcastToAll("alertsUpdated", updatedData.alerts);
    } catch (error) {
      handleError(socket, error, "Send reminder");

      // Add system error alert
      await dataManager.addAlert({
        type: "danger",
        message: `❌ Lỗi hệ thống khi gửi nhắc nhở cho ${requestData.user}: ${error.message}`,
        priority: "high",
      });

      const updatedData = await dataManager.loadData();
      broadcastToAll("alertsUpdated", updatedData.alerts);
    }
  });

  // 3. Handle new schedule creation with weekdays and usage duration
  socket.on("saveNewSchedule", async (scheduleData) => {
    try {
      // Sanitize inputs
      const sanitizedData = {
        userId: parseInt(scheduleData.userId),
        weekdays: scheduleData.weekdays || [],
        period: sanitizeInput(scheduleData.period),
        usageDuration: parseInt(scheduleData.usageDuration),
        medicines: scheduleData.medicines || [],
        notes: sanitizeInput(scheduleData.notes),
      };

      logAction(
        "Tạo lịch mới với thứ trong tuần",
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
              notes: sanitizedData.notes,
              usageDuration: sanitizedData.usageDuration,
              weekdays: sanitizedData.weekdays,
            };

            const newSchedule = await dataManager.addSchedule(scheduleItem);
            createdSchedules.push(newSchedule);
          }
        }
      }

      // Get updated schedules and broadcast
      const updatedData = await dataManager.loadData();
      broadcastToAll("scheduleUpdated", updatedData.schedules);

      socket.emit("actionResponse", {
        success: true,
        message: `Đã tạo thành công ${createdSchedules.length} lịch uống thuốc!`,
        data: createdSchedules,
      });
    } catch (error) {
      handleError(socket, error, "Save schedule");
    }
  });

  // 4. Handle user management with avatar
  socket.on("saveNewUser", async (userData) => {
    try {
      // Sanitize inputs
      const sanitizedData = {
        name: sanitizeInput(userData.name),
        avatar:
          userData.avatar || `https://i.pravatar.cc/150?img=${Date.now() % 70}`,
      };

      // Validate data
      validateUserData(sanitizedData);

      logAction("Tạo người dùng mới", sanitizedData.name);

      // Save to database
      const newUser = await dataManager.addUser(sanitizedData);

      // Get updated users and broadcast
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

  // 5. Handle user deletion
  socket.on("deleteUser", async (requestData) => {
    try {
      const userId = parseInt(requestData.id);
      logAction("Xóa người dùng", `ID: ${userId}`);

      await dataManager.deleteUser(userId);

      // Get updated data and broadcast
      const updatedData = await dataManager.loadData();
      broadcastToAll("userListUpdated", updatedData.users);
      broadcastToAll("scheduleUpdated", updatedData.schedules);
      broadcastToAll("statsUpdate", updatedData.statistics);

      socket.emit("actionResponse", {
        success: true,
        message: "Người dùng đã được xóa thành công!",
      });
    } catch (error) {
      handleError(socket, error, "Delete user");
    }
  });

  // 6. Handle medicine management
  socket.on("saveNewMedicine", async (medicineData) => {
    try {
      // Sanitize inputs
      const sanitizedData = {
        name: sanitizeInput(medicineData.name),
        dosage: sanitizeInput(medicineData.dosage),
        instructions: sanitizeInput(medicineData.instructions),
        sideEffects: sanitizeInput(medicineData.sideEffects),
        expiryDate: medicineData.expiryDate,
        quantity: parseInt(medicineData.quantity) || 0,
        minThreshold: parseInt(medicineData.minThreshold) || 5,
      };

      // Validate data
      validateMedicineData(sanitizedData);

      logAction("Tạo thuốc mới", sanitizedData.name);

      // Save to database
      const newMedicine = await dataManager.addMedicine(sanitizedData);

      // Get updated medicines and broadcast
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

  // 7. Handle schedule status updates (taken/missed)
  socket.on("updateScheduleStatus", async (statusData) => {
    try {
      const { scheduleId, status } = statusData;
      const actualTime = status === "taken" ? new Date().toISOString() : null;

      logAction(
        "Cập nhật trạng thái lịch",
        `ID: ${scheduleId}, Status: ${status}`
      );

      const updatedSchedule = await dataManager.updateScheduleStatus(
        scheduleId,
        status,
        actualTime
      );

      if (updatedSchedule) {
        // Get updated data and broadcast
        const updatedData = await dataManager.loadData();
        broadcastToAll("scheduleUpdated", updatedData.schedules);
        broadcastToAll("timelineUpdated", updatedData.timeline);
        broadcastToAll("statsUpdate", updatedData.statistics);

        socket.emit("actionResponse", {
          success: true,
          message: `Trạng thái lịch uống thuốc đã được cập nhật: ${status}`,
          data: updatedSchedule,
        });
      }
    } catch (error) {
      handleError(socket, error, "Update schedule status");
    }
  });

  // 8. Handle IoT sensor data updates
  socket.on("updateSensorData", async (sensorData) => {
    try {
      logAction("Cập nhật dữ liệu cảm biến", JSON.stringify(sensorData));

      const updatedSystem = await dataManager.updateSystemStatus({
        temperature: parseFloat(sensorData.temperature),
        humidity: parseFloat(sensorData.humidity),
        status: sensorData.status || "Online",
      });

      broadcastToAll("iotStatusUpdate", updatedSystem);
    } catch (error) {
      handleError(socket, error, "Update sensor data");
    }
  });

  // 9. Handle alert management
  socket.on("markAlertAsRead", async (alertData) => {
    try {
      const alertId = parseInt(alertData.id);
      await dataManager.markAlertAsRead(alertId);

      const updatedData = await dataManager.loadData();
      broadcastToAll("alertsUpdated", updatedData.alerts);
    } catch (error) {
      handleError(socket, error, "Mark alert as read");
    }
  });

  // 10. Handle disconnect
  // Enhanced device control socket events
  socket.on("stopIoTAlert", async (requestData) => {
    try {
      logAction(
        "Dừng cảnh báo IoT",
        `User request: ${requestData.user || "Unknown"}`
      );

      const stopSuccess = await eraIotClient.turnOffAlert();

      if (stopSuccess) {
        socket.emit("actionResponse", {
          success: true,
          message: "Đã dừng cảnh báo LED và còi trên tủ thuốc!",
          timestamp: new Date().toISOString(),
        });

        await dataManager.addAlert({
          type: "info",
          message: "🔕 Đã dừng cảnh báo IoT theo yêu cầu người dùng",
          priority: "normal",
        });
      } else {
        socket.emit("actionResponse", {
          success: false,
          message: "Lỗi kết nối! Không thể dừng cảnh báo tủ thuốc.",
          timestamp: new Date().toISOString(),
        });
      }

      const updatedData = await dataManager.loadData();
      broadcastToAll("alertsUpdated", updatedData.alerts);
    } catch (error) {
      handleError(socket, error, "Stop IoT alert");
    }
  });

  // IoT test connection
  socket.on("testIoTConnection", async () => {
    try {
      logAction("Kiểm tra kết nối IoT", "User request");

      const testSuccess = await eraIotClient.testConnection();
      const config = eraIotClient.getConfig();

      socket.emit("iotConnectionTest", {
        success: testSuccess,
        message: testSuccess
          ? "Kết nối E-Ra IoT Platform thành công! Tủ thuốc hoạt động bình thường."
          : "Lỗi kết nối E-Ra IoT Platform! Kiểm tra mạng internet và trạng thái server E-Ra.",
        config: config,
        timestamp: new Date().toISOString(),
        details: testSuccess
          ? "API endpoint có thể truy cập, IoT features đang hoạt động"
          : "Không thể kết nối tới server E-Ra, IoT features bị tạm ngưng",
      });

      await dataManager.addAlert({
        type: testSuccess ? "success" : "warning",
        message: testSuccess
          ? "✅ Test kết nối E-Ra IoT Platform thành công - Hệ thống hoạt động bình thường"
          : "⚠️ Test kết nối E-Ra IoT Platform thất bại - Kiểm tra kết nối mạng",
        priority: testSuccess ? "normal" : "high",
      });

      const updatedData = await dataManager.loadData();
      broadcastToAll("alertsUpdated", updatedData.alerts);
    } catch (error) {
      handleError(socket, error, "Test IoT connection");

      // Add system error for test failure
      await dataManager.addAlert({
        type: "danger",
        message: `❌ Lỗi hệ thống khi test IoT connection: ${error.message}`,
        priority: "high",
      });

      socket.emit("iotConnectionTest", {
        success: false,
        message: `Lỗi hệ thống khi kiểm tra kết nối: ${error.message}`,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
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
          // Trigger E-Ra IoT device for automatic medication reminder
          const iotSuccess = await eraIotClient.sendMedicationReminder(45000); // 45 second alert for automatic reminders

          if (iotSuccess) {
            // Create success reminder alert
            await dataManager.addAlert({
              type: "success",
              message: `🔔 Đến giờ uống thuốc! ${user.name} cần uống ${medicine.name} (${medicine.dosage}) - ${schedule.period}. Tủ thuốc đang phát cảnh báo LED + còi.`,
              priority: "high",
            });

            console.log(
              `[E-Ra IoT] Automatic medication reminder sent for ${user.name} - ${medicine.name}`
            );
          } else {
            // Create warning if IoT failed but still notify
            await dataManager.addAlert({
              type: "warning",
              message: `⏰ Đến giờ uống thuốc! ${user.name} cần uống ${medicine.name} (${medicine.dosage}) - ${schedule.period}. ⚠️ Lỗi kết nối tủ thuốc IoT!`,
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
            `${user.name} - ${medicine.name} - ${schedule.period} - IoT: ${
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
// Route upload avatar
app.post("/api/upload-avatar", upload.single("avatar"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Không có file nào được tải lên",
      });
    }

    const filePath = `/assets/downloads/profile/${req.file.filename}`;

    res.json({
      success: true,
      message: "Ảnh đã được tải lên thành công",
      filePath: filePath,
      originalName: req.file.originalname,
      size: req.file.size,
    });

    logAction(
      "Upload avatar",
      `File: ${req.file.filename}, Size: ${req.file.size}`
    );
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
  server.close(() => {
    console.log("✅ Server đã tắt thành công");
    process.exit(0);
  });
});

// === START SERVER ===
server.listen(PORT, async () => {
  console.log(`🚀 Tủ Thuốc AIoT Server đang chạy tại http://localhost:${PORT}`);
  console.log(`📊 Connected clients: ${connectedClients.size}`);
  console.log(`🏥 System ready for medicine management`);

  // Initialize data on startup
  try {
    await dataManager.loadData();
    console.log("✅ Dữ liệu hệ thống đã được khởi tạo");
  } catch (error) {
    console.error("❌ Lỗi khởi tạo dữ liệu:", error);
  }
});
