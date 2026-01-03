// Alert Scheduler Service for Medicine Reminders
// Manages automatic E-Ra IoT alerts based on schedule times

const cron = require("node-cron");
const http = require("http");
const EraIotClient = require("./eraIotClient");

class AlertScheduler {
  constructor(dataManager, io) {
    this.dataManager = dataManager;
    this.io = io; // Socket.IO instance
    this.eraIotClient = new EraIotClient();
    this.scheduledTasks = new Map(); // Store active cron jobs
    this.isInitialized = false;

    console.log("[AlertScheduler] Service initialized");
  }

  // Trigger Raspberry Pi Check-in via Socket.IO
  triggerRaspberryPi() {
    return new Promise((resolve) => {
      if (!this.io) {
        console.error("[AlertScheduler] Socket.IO not initialized");
        resolve(false);
        return;
      }

      console.log(
        "[AlertScheduler] Emitting 'triggerCheckin' event to Raspberry Pi..."
      );

      // Emit event to all connected clients (including the Pi)
      // In a more complex setup, you might want to target a specific socket ID
      this.io.emit("triggerCheckin", { timestamp: Date.now() });

      // Assume success if emitted, as we can't easily get an ack from a broadcast
      // Alternatively, implement an acknowledgement callback if needed
      resolve(true);
    });
  }

  // Initialize scheduler và load tất cả schedules từ DB
  async initialize() {
    try {
      console.log("[AlertScheduler] Loading existing schedules...");
      const data = await this.dataManager.loadData();

      // Schedule alerts cho tất cả pending schedules
      const pendingSchedules = data.schedules.filter(
        (s) => s.status === "pending"
      );
      console.log(
        `[AlertScheduler] Found ${pendingSchedules.length} pending schedules to monitor`
      );

      for (const schedule of pendingSchedules) {
        await this.scheduleAlert(schedule);
      }

      this.isInitialized = true;
      console.log("[AlertScheduler] Initialization completed");
    } catch (error) {
      console.error("[AlertScheduler] Initialization failed:", error);
    }
  }

  // Schedule một alert mới
  async scheduleAlert(schedule) {
    try {
      // Tạo cron expression từ schedule data
      const cronExpression = this.createCronExpression(schedule);
      if (!cronExpression) {
        console.warn(
          `[AlertScheduler] Cannot create cron for schedule ${schedule.id}`
        );
        return;
      }

      // Check if task already exists
      if (this.scheduledTasks.has(schedule.id)) {
        console.log(
          `[AlertScheduler] Task ${schedule.id} already scheduled, skipping`
        );
        return;
      }

      console.log(
        `[AlertScheduler] Scheduling alert for schedule ${schedule.id}: ${cronExpression}`
      );

      // Create cron job
      const task = cron.schedule(
        cronExpression,
        async () => {
          await this.triggerAlert(schedule);
        },
        {
          scheduled: true,
          timezone: "Asia/Ho_Chi_Minh",
        }
      );

      // Store task reference
      this.scheduledTasks.set(schedule.id, task);

      console.log(
        `[AlertScheduler] Successfully scheduled alert for schedule ${schedule.id}`
      );
    } catch (error) {
      console.error(
        `[AlertScheduler] Failed to schedule alert for ${schedule.id}:`,
        error
      );
    }
  }

  // Tạo cron expression từ schedule data
  createCronExpression(schedule) {
    try {
      let minute, hour;

      if (schedule.period === "custom" && schedule.customTime) {
        [hour, minute] = schedule.customTime.split(":").map(Number);
      } else {
        // Default periods
        const periodTimes = {
          Sáng: { hour: 7, minute: 0 },
          Trưa: { hour: 12, minute: 0 },
          Chiều: { hour: 17, minute: 0 },
          Tối: { hour: 20, minute: 0 },
        };

        const periodTime = periodTimes[schedule.period];
        if (!periodTime) {
          console.warn(`[AlertScheduler] Unknown period: ${schedule.period}`);
          return null;
        }

        hour = periodTime.hour;
        minute = periodTime.minute;
      }

      // Validate time
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        console.warn(`[AlertScheduler] Invalid time: ${hour}:${minute}`);
        return null;
      }

      // Tạo cron cho specific dates hoặc weekdays
      if (schedule.date) {
        // For specific date schedules
        const scheduleDate = new Date(schedule.date);
        const day = scheduleDate.getDate();
        const month = scheduleDate.getMonth() + 1;

        return `${minute} ${hour} ${day} ${month} *`;
      } else if (schedule.weekdays && schedule.weekdays.length > 0) {
        // For weekly recurring schedules
        // Convert weekdays (0=Sunday) to cron format (0=Sunday, 1=Monday, etc.)
        const cronWeekdays = schedule.weekdays.join(",");
        return `${minute} ${hour} * * ${cronWeekdays}`;
      }

      console.warn(
        `[AlertScheduler] No valid date or weekdays for schedule ${schedule.id}`
      );
      return null;
    } catch (error) {
      console.error(`[AlertScheduler] Error creating cron expression:`, error);
      return null;
    }
  }

  // Trigger E-Ra IoT alert
  async triggerAlert(schedule) {
    try {
      console.log(
        `[AlertScheduler] Triggering alert for schedule ${
          schedule.id
        } at ${new Date()}`
      );

      // Get user and medicine details
      const data = await this.dataManager.loadData();
      const user = data.users.find((u) => u.id === schedule.userId);
      const medicine = data.medicines.find((m) => m.id === schedule.medicineId);

      if (!user || !medicine) {
        console.error(
          `[AlertScheduler] Missing user or medicine data for schedule ${schedule.id}`
        );
        return;
      }

      // Send IoT alert (30 seconds duration)
      const iotSuccess = await this.eraIotClient.sendMedicationReminder(30000);

      // Trigger Raspberry Pi Camera Check-in
      const piSuccess = await this.triggerRaspberryPi();

      if (iotSuccess) {
        console.log(
          `[AlertScheduler] IoT alert sent successfully for ${user.name} - ${medicine.name}`
        );

        // Add success alert to system
        await this.dataManager.addAlert({
          type: "success",
          message: `Alert tự động: ${user.name} cần uống ${
            medicine.name
          } - IoT đã được kích hoạt! ${
            piSuccess ? "(Camera ON)" : "(Camera Error)"
          }`,
          priority: "high",
        });
      } else {
        console.error(
          `[AlertScheduler] IoT alert failed for ${user.name} - ${medicine.name}`
        );

        // Add error alert to system
        await this.dataManager.addAlert({
          type: "warning",
          message: `Alert tự động: ${user.name} cần uống ${medicine.name} - Lỗi kết nối IoT!`,
          priority: "high",
        });
      }

      // Log the alert activity
      const timelineEntry = {
        id: Date.now(),
        userId: schedule.userId,
        scheduleId: schedule.id,
        time: new Date().toISOString(),
        user: user.name,
        medicine: `${medicine.name} (${medicine.dosage})`,
        status: "auto_alert",
        period: schedule.period,
        customTime: schedule.customTime,
        type: "automatic_reminder",
      };

      // Add to timeline
      const updatedData = await this.dataManager.loadData();
      updatedData.timeline.push(timelineEntry);
      await this.dataManager.saveData(updatedData);
    } catch (error) {
      console.error(
        `[AlertScheduler] Failed to trigger alert for schedule ${schedule.id}:`,
        error
      );
    }
  }

  // Add new schedule to monitoring
  async addSchedule(schedule) {
    if (!this.isInitialized) {
      console.warn(
        "[AlertScheduler] Service not initialized, skipping schedule add"
      );
      return;
    }

    await this.scheduleAlert(schedule);
  }

  // Remove schedule from monitoring
  removeSchedule(scheduleId) {
    const task = this.scheduledTasks.get(scheduleId);
    if (task) {
      task.destroy();
      this.scheduledTasks.delete(scheduleId);
      console.log(
        `[AlertScheduler] Removed schedule ${scheduleId} from monitoring`
      );
    }
  }

  // Update schedule monitoring
  async updateSchedule(schedule) {
    // Remove old task
    this.removeSchedule(schedule.id);

    // Add new task if still pending
    if (schedule.status === "pending") {
      await this.scheduleAlert(schedule);
    }
  }

  // Get status of all scheduled tasks
  getStatus() {
    return {
      initialized: this.isInitialized,
      activeAlerts: this.scheduledTasks.size,
      scheduledIds: Array.from(this.scheduledTasks.keys()),
    };
  }

  // Cleanup all scheduled tasks
  cleanup() {
    console.log("[AlertScheduler] Cleaning up scheduled tasks...");
    this.scheduledTasks.forEach((task, id) => {
      task.destroy();
    });
    this.scheduledTasks.clear();
    console.log("[AlertScheduler] Cleanup completed");
  }
}

module.exports = AlertScheduler;
