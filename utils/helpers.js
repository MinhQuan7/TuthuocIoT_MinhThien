// Utility functions for date and time handling

const getTodayString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateTime = (date) => {
  return new Date(date).toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const getPeriodTime = (period, customTime = null) => {
  // Handle custom time format
  if (period === "custom" && customTime) {
    const [hours, minutes] = customTime.split(":").map(Number);
    return {
      hour: hours,
      minute: minutes || 0,
      label: customTime,
    };
  }

  const periods = {
    Sáng: { hour: 7, minute: 0, label: "7:00 AM" },
    Trưa: { hour: 12, minute: 0, label: "12:00 PM" },
    Chiều: { hour: 17, minute: 0, label: "5:00 PM" },
    Tối: { hour: 20, minute: 0, label: "8:00 PM" },
  };
  return periods[period] || { hour: 9, minute: 0, label: "9:00 AM" };
};

const isTimeForReminder = (schedule) => {
  const now = new Date();
  const scheduleDate = new Date(schedule.date);

  // Check if it's the right day
  if (scheduleDate.toDateString() !== now.toDateString()) {
    return false;
  }

  const periodTime = getPeriodTime(schedule.period, schedule.customTime);
  const reminderTime = new Date(scheduleDate);
  reminderTime.setHours(periodTime.hour, periodTime.minute || 0, 0, 0);

  // Remind 15 minutes before the scheduled time
  const reminderWindow = new Date(reminderTime.getTime() - 15 * 60 * 1000);

  return now >= reminderWindow && now <= reminderTime;
};

const generateId = () => {
  return Date.now() + Math.random().toString(36).substr(2, 9);
};

const validateScheduleData = (data) => {
  const required = ["userId", "medicineId", "date", "period"];
  const missing = required.filter((field) => !data[field]);

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }

  const validPeriods = ["Sáng", "Trưa", "Chiều", "Tối", "custom"];
  if (!validPeriods.includes(data.period)) {
    throw new Error(
      "Invalid period. Must be one of: " + validPeriods.join(", ")
    );
  }

  // Validate custom time format
  if (data.period === "custom") {
    if (!data.customTime) {
      throw new Error("Custom time is required when period is 'custom'");
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(data.customTime)) {
      throw new Error("Invalid custom time format. Use HH:MM format (24-hour)");
    }
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(data.date)) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  return true;
};

const validateUserData = (data) => {
  if (!data.name || data.name.trim().length === 0) {
    throw new Error("User name is required");
  }

  if (data.name.length > 50) {
    throw new Error("User name must be less than 50 characters");
  }

  return true;
};

const validateMedicineData = (data) => {
  const required = ["name", "dosage"];
  const missing = required.filter(
    (field) => !data[field] || data[field].trim().length === 0
  );

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }

  if (data.quantity && (isNaN(data.quantity) || data.quantity < 0)) {
    throw new Error("Quantity must be a non-negative number");
  }

  return true;
};

const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;

  return input
    .trim()
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .substring(0, 255); // Limit length
};

module.exports = {
  getTodayString,
  formatDateTime,
  getPeriodTime,
  isTimeForReminder,
  generateId,
  validateScheduleData,
  validateUserData,
  validateMedicineData,
  sanitizeInput,
};
