const fs = require("fs").promises;
const path = require("path");

// Helper function để generate unique ID
function generateId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

class DataManager {
  constructor() {
    this.dataFile = path.join(__dirname, "../data/heThongData.json");
    this.backupFile = path.join(__dirname, "../data/backup.json");
    this.ensureDataDirectory();
  }

  async ensureDataDirectory() {
    const dataDir = path.dirname(this.dataFile);
    try {
      await fs.access(dataDir);
    } catch (error) {
      await fs.mkdir(dataDir, { recursive: true });
    }
  }

  getDefaultData() {
    const now = new Date();
    return {
      metadata: {
        version: "2.0.0",
        lastUpdate: now.toISOString(),
        created: now.toISOString(),
      },
      system: {
        status: "Online",
        temperature: 25.0,
        humidity: 65,
        lastSensorUpdate: now.toISOString(),
      },
      users: [],
      medicines: [],
      schedules: [],
      timeline: [],
      alerts: [],
      reminders: [],
      inventory: {
        totalMedicines: 0,
        lowStock: [],
        expiringSoon: [],
        expired: [],
        lastUpdated: now.toISOString(),
      },
      statistics: {
        compliance: {},
        labels: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
        dailyBreakdown: {},
        weeklyUsage: {},
        monthlyTrends: {},
      },
    };
  }

  async loadData() {
    try {
      await this.ensureDataDirectory();
      const data = await fs.readFile(this.dataFile, "utf8");
      const parsedData = JSON.parse(data);

      // Validate and merge with default structure
      const defaultData = this.getDefaultData();
      const mergedData = this.mergeWithDefaults(parsedData, defaultData);

      // Debug log cho việc load data
      console.log(`[DataManager] Data loaded successfully:`, {
        users: mergedData.users?.length || 0,
        medicines: mergedData.medicines?.length || 0,
        schedules: mergedData.schedules?.length || 0,
        alerts: mergedData.alerts?.length || 0,
      });

      if (mergedData.users && mergedData.users.length > 0) {
        console.log(
          `[DataManager] User details:`,
          mergedData.users.map((u) => ({
            id: u.id,
            name: u.name,
            active: u.isActive,
          }))
        );
      }

      return mergedData;
    } catch (error) {
      console.log("[DataManager] Khởi tạo dữ liệu mặc định:", error.message);
      const defaultData = this.getDefaultData();
      await this.saveData(defaultData);

      console.log(`[DataManager] Default data created:`, {
        users: defaultData.users?.length || 0,
        medicines: defaultData.medicines?.length || 0,
        schedules: defaultData.schedules?.length || 0,
        alerts: defaultData.alerts?.length || 0,
      });

      return defaultData;
    }
  }

  mergeWithDefaults(data, defaults) {
    const merged = { ...defaults };

    // Merge existing data while preserving structure
    Object.keys(defaults).forEach((key) => {
      if (data[key] !== undefined) {
        if (
          typeof defaults[key] === "object" &&
          !Array.isArray(defaults[key])
        ) {
          merged[key] = { ...defaults[key], ...data[key] };
        } else {
          merged[key] = data[key];
        }
      }
    });

    // Update metadata
    merged.metadata.lastUpdate = new Date().toISOString();
    return merged;
  }

  async saveData(data) {
    try {
      await this.ensureDataDirectory();

      // Recalculate statistics before saving to ensure consistency
      this.recalculateStatistics(data);

      // Update metadata
      data.metadata.lastUpdate = new Date().toISOString();

      // Create backup before saving
      try {
        const currentData = await fs.readFile(this.dataFile, "utf8");
        await fs.writeFile(this.backupFile, currentData);
      } catch (error) {
        // Ignore backup errors on first save
      }

      // Save main data
      await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2));
      console.log("[DataManager] Dữ liệu đã được lưu thành công");
      return true;
    } catch (error) {
      console.error("[DataManager] Lỗi lưu dữ liệu:", error);
      throw error;
    }
  }

  async addUser(userData) {
    const data = await this.loadData();
    const newUser = {
      id: Date.now(),
      name: userData.name,
      avatar:
        userData.avatar || `https://i.pravatar.cc/150?img=${Date.now() % 70}`,
      avatars: userData.avatars || [],
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    data.users.push(newUser);

    // Initialize statistics for new user
    data.statistics.compliance[`user${newUser.id}`] = 0;
    data.statistics.dailyBreakdown[`user${newUser.id}`] = [0, 0, 0, 0, 0, 0, 0];

    await this.saveData(data);
    return newUser;
  }

  async deleteUser(userId) {
    const data = await this.loadData();

    // Remove user
    data.users = data.users.filter((user) => user.id !== userId);

    // Remove user's schedules
    data.schedules = data.schedules.filter(
      (schedule) => schedule.userId !== userId
    );

    // Remove user's timeline entries
    data.timeline = data.timeline.filter((entry) => entry.userId !== userId);

    // Remove user's statistics
    delete data.statistics.compliance[`user${userId}`];
    delete data.statistics.dailyBreakdown[`user${userId}`];

    await this.saveData(data);
    return true;
  }

  async addMedicine(medicineData) {
    const data = await this.loadData();
    const newMedicine = {
      id: Date.now(),
      name: medicineData.name,
      category: medicineData.category || "other",
      dosage: medicineData.dosage,
      instructions: medicineData.instructions || "",
      sideEffects: medicineData.sideEffects || "",
      expiryDate: medicineData.expiryDate || null,
      quantity: medicineData.quantity || 0,
      minThreshold: medicineData.minThreshold || 5,
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    data.medicines.push(newMedicine);

    // Cập nhật inventory sau khi thêm medicine
    this.updateInventoryData(data);

    await this.saveData(data);
    return newMedicine;
  }

  async deleteMedicine(medicineId) {
    const data = await this.loadData();
    const initialLength = data.medicines.length;

    // Find medicine name before deleting to clean up alerts
    const medicineToDelete = data.medicines.find(
      (m) => m.id === parseInt(medicineId)
    );
    const medicineName = medicineToDelete ? medicineToDelete.name : null;

    data.medicines = data.medicines.filter(
      (m) => m.id !== parseInt(medicineId)
    );

    if (data.medicines.length < initialLength) {
      // Remove alerts related to this medicine
      if (medicineName) {
        data.alerts = data.alerts.filter(
          (alert) => !alert.message.includes(medicineName)
        );
      }

      this.updateInventoryData(data);
      await this.saveData(data);
      return true;
    }
    return false;
  }

  async addSchedule(scheduleData) {
    const data = await this.loadData();

    // Nếu có medicineName, tạo hoặc tìm medicine
    let medicineId = scheduleData.medicineId;
    if (scheduleData.medicineName && !medicineId) {
      // Tìm medicine đã tồn tại
      let existingMedicine = data.medicines.find(
        (m) => m.name === scheduleData.medicineName
      );

      if (!existingMedicine) {
        // Tạo medicine mới
        const newMedicine = {
          id: Date.now() + Math.random() * 1000,
          name: scheduleData.medicineName,
          category: scheduleData.medicineCategory || "other",
          dosage: "Theo chỉ định bác sỹ",
          instructions: "",
          quantity: 30, // Mặc định 30 viên
          minThreshold: 5,
          expiryDate: null,
          createdAt: new Date().toISOString(),
        };
        data.medicines.push(newMedicine);
        medicineId = newMedicine.id;
      } else {
        medicineId = existingMedicine.id;
      }
    }

    const newSchedule = {
      id: generateId(),
      userId: parseInt(scheduleData.userId),
      medicineId: medicineId,
      date: scheduleData.date,
      period: scheduleData.period,
      customTime: scheduleData.customTime || null,
      status: "pending",
      createdAt: new Date().toISOString(),
      actualTime: null,
      notes: scheduleData.notes || "",
      weekdays: scheduleData.weekdays || [],
      usageDuration: scheduleData.usageDuration || 30,
      endDate: scheduleData.endDate || null,
    };

    data.schedules.push(newSchedule);

    // Cập nhật inventory
    this.updateInventoryData(data);

    await this.saveData(data);
    return newSchedule;
  }

  async updateScheduleStatus(scheduleId, status, actualTime = null) {
    const data = await this.loadData();
    const schedule = data.schedules.find((s) => s.id === parseInt(scheduleId));

    if (schedule) {
      schedule.status = status;
      if (actualTime) {
        schedule.actualTime = actualTime;
      }

      // Add to timeline
      const user = data.users.find((u) => u.id === schedule.userId);
      const medicine = data.medicines.find((m) => m.id === schedule.medicineId);

      if (user && medicine) {
        const timelineEntry = {
          id: Date.now(),
          userId: schedule.userId,
          scheduleId: schedule.id,
          time: actualTime || new Date().toISOString(),
          user: user.name,
          medicine: `${medicine.name} (${medicine.dosage})`,
          status: status,
          period: schedule.period,
          customTime: schedule.customTime,
        };

        data.timeline.push(timelineEntry);

        // Update statistics
        this.recalculateStatistics(data);
      }

      await this.saveData(data);
      return schedule;
    }
    return null;
  }

  recalculateStatistics(data) {
    // Initialize statistics structure if missing
    if (!data.statistics) {
      data.statistics = {
        compliance: {},
        labels: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
        dailyBreakdown: {},
        weeklyUsage: {},
        monthlyTrends: {},
      };
    }

    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;

    // Calculate start of the current week (Monday)
    // getDay(): 0 (Sun) -> 6 (Sat). We want Mon (1) to be index 0.
    const currentDay = now.getDay(); // 0-6
    const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - daysToMonday);
    const nextMonday = new Date(monday.getTime() + 7 * oneDay);

    // Iterate users
    data.users.forEach((user) => {
      const userKey = `user${user.id}`;

      // Reset daily breakdown for this user
      data.statistics.dailyBreakdown[userKey] = [0, 0, 0, 0, 0, 0, 0];

      // Filter schedules for this user
      const userSchedules = data.schedules.filter((s) => s.userId === user.id);

      // 1. Compliance (Last 7 days rolling window)
      // We consider schedules from 7 days ago up to now
      const sevenDaysAgo = new Date(now.getTime() - 7 * oneDay);
      const recentSchedules = userSchedules.filter((s) => {
        const d = new Date(s.date);
        return d >= sevenDaysAgo && d <= now;
      });

      const takenCount = recentSchedules.filter(
        (s) => s.status === "taken" || s.status === "late"
      ).length;
      const totalCount = recentSchedules.length;

      data.statistics.compliance[userKey] =
        totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

      // 2. Daily Breakdown (Current Week Mon-Sun)
      // We iterate through schedules that fall within this week (Mon -> Sun)
      const thisWeekSchedules = userSchedules.filter((s) => {
        const d = new Date(s.date);
        return (
          d >= monday &&
          d < nextMonday &&
          (s.status === "taken" || s.status === "late")
        );
      });

      thisWeekSchedules.forEach((s) => {
        const d = new Date(s.date);
        // Calculate day index (0=Mon, 6=Sun)
        let dayIndex = d.getDay() - 1;
        if (dayIndex === -1) dayIndex = 6; // Sunday

        if (dayIndex >= 0 && dayIndex <= 6) {
          data.statistics.dailyBreakdown[userKey][dayIndex]++;
        }
      });
    });

    return data;
  }

  updateInventoryData(data) {
    const now = new Date();
    const inventory = {
      totalMedicines: data.medicines.length,
      lowStock: [],
      expiringSoon: [],
      expired: [],
      lastUpdated: now.toISOString(),
    };

    data.medicines.forEach((medicine) => {
      // Kiểm tra số lượng tồn kho
      if (medicine.quantity <= medicine.minThreshold) {
        inventory.lowStock.push({
          id: medicine.id,
          name: medicine.name,
          quantity: medicine.quantity,
          threshold: medicine.minThreshold,
          daysRemaining: this.calculateDaysRemaining(
            medicine.id,
            data.schedules
          ),
        });
      }

      // Kiểm tra hạn sử dụng
      if (medicine.expiryDate) {
        const expiryDate = new Date(medicine.expiryDate);
        const daysToExpiry = Math.ceil(
          (expiryDate - now) / (1000 * 60 * 60 * 24)
        );

        if (daysToExpiry <= 0) {
          inventory.expired.push({
            id: medicine.id,
            name: medicine.name,
            expiryDate: medicine.expiryDate,
            daysExpired: Math.abs(daysToExpiry),
          });
        } else if (daysToExpiry <= 30) {
          inventory.expiringSoon.push({
            id: medicine.id,
            name: medicine.name,
            expiryDate: medicine.expiryDate,
            daysToExpiry: daysToExpiry,
          });
        }
      }
    });

    data.inventory = inventory;
  }

  calculateDaysRemaining(medicineId, schedules) {
    // Tính toán số ngày còn lại dựa trên lịch uống
    const medicineSchedules = schedules.filter(
      (s) => s.medicineId === medicineId && s.status === "pending"
    );
    const medicine = this.medicines?.find((m) => m.id === medicineId);

    if (!medicine || medicineSchedules.length === 0) {
      return medicine?.quantity || 0;
    }

    // Ước tính dựa trên tần suất uống hàng ngày
    const dailyFrequency = medicineSchedules.length / 7; // Giả sử lịch theo tuần
    return Math.floor(medicine.quantity / dailyFrequency);
  }

  async addAlert(alertData) {
    const data = await this.loadData();
    const newAlert = {
      id: Date.now(),
      type: alertData.type || "info",
      message: alertData.message,
      createdAt: new Date().toISOString(),
      isRead: false,
      priority: alertData.priority || "normal",
    };

    data.alerts.push(newAlert);
    await this.saveData(data);
    return newAlert;
  }

  async markAlertAsRead(alertId) {
    const data = await this.loadData();
    const alert = data.alerts.find((a) => a.id === parseInt(alertId));

    if (alert) {
      alert.isRead = true;
      await this.saveData(data);
      return alert;
    }
    return null;
  }

  async clearAllAlerts() {
    const data = await this.loadData();
    data.alerts = [];
    await this.saveData(data);
    return true;
  }

  async updateSystemStatus(statusData) {
    const data = await this.loadData();

    data.system = {
      ...data.system,
      ...statusData,
      lastSensorUpdate: new Date().toISOString(),
    };

    await this.saveData(data);
    return data.system;
  }

  async getSchedulesForToday() {
    const data = await this.loadData();
    const today = new Date().toISOString().split("T")[0];

    return data.schedules
      .filter((schedule) => schedule.date === today)
      .sort((a, b) => {
        // Helper function to get sort value for periods
        const getPeriodSortValue = (period, customTime) => {
          if (period === "custom" && customTime) {
            const [hours, minutes] = customTime.split(":").map(Number);
            return hours * 60 + minutes; // Convert to minutes for sorting
          }
          const periods = { Sáng: 480, Trưa: 720, Chiều: 1020, Tối: 1200 }; // in minutes
          return periods[period] || 999999;
        };

        return (
          getPeriodSortValue(a.period, a.customTime) -
          getPeriodSortValue(b.period, b.customTime)
        );
      });
  }

  async getPendingReminders() {
    const data = await this.loadData();
    const now = new Date();

    return data.schedules.filter((schedule) => {
      if (schedule.status !== "pending") return false;

      const scheduleDate = new Date(schedule.date);
      const isToday = scheduleDate.toDateString() === now.toDateString();

      // Check if it's time for reminder based on period or custom time
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      let targetHour,
        targetMinute = 0;

      if (schedule.period === "custom" && schedule.customTime) {
        [targetHour, targetMinute] = schedule.customTime.split(":").map(Number);
      } else {
        const periodHours = {
          Sáng: 7,
          Trưa: 12,
          Chiều: 17,
          Tối: 20,
        };
        targetHour = periodHours[schedule.period] || 9;
      }

      // Check if current time >= target time
      const currentTotalMinutes = currentHour * 60 + currentMinute;
      const targetTotalMinutes = targetHour * 60 + targetMinute;

      return isToday && currentTotalMinutes >= targetTotalMinutes;
    });
  }
}

module.exports = DataManager;
