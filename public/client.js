document.addEventListener("DOMContentLoaded", function () {
  const socket = io();
  console.log("Đang kết nối tới máy chủ...");

  // === LẤY CÁC PHẦN TỬ DOM ===
  const dateTimeElement = document.getElementById("current-date-time");
  const pageTitle = document.getElementById("page-title");

  // Trang Tổng quan
  const deviceStatus = document.getElementById("device-status");
  const deviceTemp = document.getElementById("device-temp");
  const deviceHumidity = document.getElementById("device-humidity");
  const alertList = document.getElementById("alert-list");
  const timelineList = document.getElementById("timeline-list");
  const statUser1 = document.getElementById("stat-user-1");
  const statBar1 = document.getElementById("stat-bar-1");
  const statUser2 = document.getElementById("stat-user-2");
  const statBar2 = document.getElementById("stat-bar-2");

  // Trang Lịch Cài đặt
  const addScheduleForm = document.getElementById("add-schedule-form");
  const scheduleList = document.getElementById("schedule-list");
  const dateInput = document.getElementById("date-input");
  const userSelectDropdown = document.getElementById("user-select-dropdown");
  const medicineSelectDropdown = document.getElementById(
    "medicine-select-dropdown"
  );
  const periodSelect = document.getElementById("period-select");
  const customTimeContainer = document.getElementById("custom-time-container");
  const customTimeInput = document.getElementById("custom-time-input");

  // Trang Thống kê
  const chartCanvas = document.getElementById("complianceChart");
  let complianceChartInstance = null;

  // Trang Quản lý Thuốc
  const addMedicineForm = document.getElementById("add-medicine-form");
  const medicineList = document.getElementById("medicine-list");

  // Trang Quản lý Người dùng
  const addUserForm = document.getElementById("add-user-form");
  const userList = document.getElementById("user-list");

  // Biến cho các tính năng mới
  const weekdaysContainer = document.getElementById("weekdays-container");
  const medicineCategorySelect = document.getElementById(
    "medicine-category-select"
  );
  const medicineNameInput = document.getElementById("medicine-name-input");
  const selectedMedicinesContainer = document.getElementById(
    "selected-medicines-container"
  );
  const usageDurationInput = document.getElementById("usage-duration");
  const avatarFileInput = document.getElementById("user-avatar-file");
  const avatarPreview = document.getElementById("avatar-preview");
  const previewImage = document.getElementById("preview-image");
  const removeAvatarBtn = document.getElementById("remove-avatar");

  // Biến lưu trữ dữ liệu cục bộ
  let localDataStore = {};
  let selectedMedicines = [];
  let uploadedAvatarPath = null;

  // Danh sách thuốc theo danh mục
  const medicinesByCategory = {
    "pain-relief": [
      "Paracetamol 500mg",
      "Ibuprofen 400mg",
      "Aspirin 100mg",
      "Diclofenac 50mg",
    ],
    "cold-flu": [
      "Thuốc cảm Decolgen",
      "Viêm họng Strepsils",
      "Ho Prospan",
      "Sốt Efferalgan",
    ],
    digestive: ["Smecta", "Bioflora", "Motilium", "Gastropulgite"],
    heart: [
      "Cardipine 10mg",
      "Atenolol 50mg",
      "Amlodipin 5mg",
      "Metoprolol 25mg",
    ],
    diabetes: [
      "Metformin 500mg",
      "Glibenclamide 5mg",
      "Insulin NPH",
      "Acarbose 50mg",
    ],
    "blood-pressure": [
      "Losartan 50mg",
      "Captopril 25mg",
      "Amlodipine 10mg",
      "Hydrochlorothiazide 25mg",
    ],
    vitamins: [
      "Vitamin C 1000mg",
      "Vitamin D3 2000IU",
      "B-Complex",
      "Omega 3",
      "Calcium + Magnesium",
    ],
    antibiotics: [
      "Amoxicillin 500mg",
      "Azithromycin 250mg",
      "Cephalexin 500mg",
      "Clarithromycin 250mg",
    ],
    other: ["Thuốc khác tùy chọn"],
  };

  // Notification system
  function showNotification(message, type = "info", duration = 3000) {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${getNotificationIcon(type)}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `;

    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
      border-left: 4px solid ${getNotificationColor(type)};
      z-index: 1000;
      min-width: 300px;
      transform: translateX(400px);
      transition: transform 0.3s ease;
    `;

    notification.querySelector(".notification-content").style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      color: #1e293b;
    `;

    document.body.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
      notification.style.transform = "translateX(0)";
    });

    // Close functionality
    const closeBtn = notification.querySelector(".notification-close");
    closeBtn.onclick = () => removeNotification(notification);

    // Auto remove
    setTimeout(() => {
      if (document.body.contains(notification)) {
        removeNotification(notification);
      }
    }, duration);
  }

  function removeNotification(notification) {
    notification.style.transform = "translateX(400px)";
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  }

  function getNotificationIcon(type) {
    const icons = {
      success: "✅",
      error: "❌",
      warning: "⚠️",
      info: "📊",
    };
    return icons[type] || icons.info;
  }

  function getNotificationColor(type) {
    const colors = {
      success: "#10b981",
      error: "#ef4444",
      warning: "#f59e0b",
      info: "#3b82f6",
    };
    return colors[type] || colors.info;
  }

  // Hàm tiện ích lấy ngày hôm nay (YYYY-MM-DD)
  const getTodayString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // *** CẬP NHẬT: Thêm đối tượng để sắp xếp Buổi với hỗ trợ custom time ***
  function getPeriodSortValue(period, customTime) {
    if (period === "custom" && customTime) {
      // Convert HH:MM to minutes for sorting
      const [hours, minutes] = customTime.split(":").map(Number);
      return hours * 60 + minutes;
    }

    const periodOrder = { Sáng: 480, Trưa: 720, Chiều: 1020, Tối: 1200 }; // in minutes
    return periodOrder[period] || 999999;
  }

  // === LOGIC ĐIỀU HƯỚNG (NAVIGATION) ===
  const navLinks = document.querySelectorAll(".nav-link");
  const pages = document.querySelectorAll(".page-content");

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();

      const targetPageId = link.dataset.page;
      if (!targetPageId) return;

      // Log để debug
      console.log(`Switching to page: ${targetPageId}`);

      // Remove active class từ tất cả pages
      pages.forEach((page) => {
        page.classList.remove("active");
        console.log(`Removed active from: ${page.id}`);
      });

      // Tìm và active target page
      const targetPage = document.getElementById(targetPageId);
      if (targetPage) {
        targetPage.classList.add("active");
        console.log(`Added active to: ${targetPageId}`);
      } else {
        console.error("Không tìm thấy trang với ID:", targetPageId);
        return;
      }

      // Cập nhật page title
      if (pageTitle) {
        pageTitle.textContent = link.textContent.trim();
      }

      // Update navigation active state
      navLinks.forEach((nav) => nav.classList.remove("active"));
      link.classList.add("active");

      // Special page logic
      if (targetPageId === "page-stats" && localDataStore.statistics) {
        renderStatisticsChart(localDataStore.statistics);
      }

      // *** CẬP NHẬT: Tự động điền ngày & BUỔI hiện tại ***
      if (targetPageId === "page-schedule") {
        const now = new Date();
        const currentHour = now.getHours();

        if (dateInput) dateInput.value = getTodayString();

        if (periodSelect) {
          if (currentHour < 10) periodSelect.value = "Sáng"; // Trước 10h sáng
          else if (currentHour < 14) periodSelect.value = "Trưa"; // 10h - 14h
          else if (currentHour < 19) periodSelect.value = "Chiều"; // 14h - 19h
          else periodSelect.value = "Tối"; // Sau 19h
        }
      }
    });
  });

  // === Hàm xử lý upload avatar ===
  function initAvatarUpload() {
    if (avatarFileInput) {
      avatarFileInput.addEventListener("change", function (e) {
        const file = e.target.files[0];
        if (file) {
          if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = function (e) {
              previewImage.src = e.target.result;
              avatarPreview.classList.remove("hidden");
            };
            reader.readAsDataURL(file);

            // Upload file to server
            uploadAvatarFile(file);
          } else {
            showNotification("⚠️ Vui lòng chọn file ảnh!", "error");
          }
        }
      });
    }

    if (removeAvatarBtn) {
      removeAvatarBtn.addEventListener("click", function () {
        resetAvatarUpload();
        showNotification("📷 Đã xóa ảnh đã chọn!", "info");
      });
    }
  }

  // Function to completely reset avatar upload state
  function resetAvatarUpload() {
    if (avatarFileInput) avatarFileInput.value = "";

    // Smooth animation when hiding preview
    if (avatarPreview && !avatarPreview.classList.contains("hidden")) {
      avatarPreview.style.opacity = "0";
      avatarPreview.style.transform = "scale(0.8)";

      setTimeout(() => {
        avatarPreview.classList.add("hidden");
        avatarPreview.style.opacity = "";
        avatarPreview.style.transform = "";
      }, 200);
    }

    if (previewImage) previewImage.src = "";
    uploadedAvatarPath = null;

    // Clear URL input as well
    const avatarUrlInput = document.getElementById("user-avatar-input");
    if (avatarUrlInput) avatarUrlInput.value = "";

    console.log("Avatar upload state reset");
  }

  function uploadAvatarFile(file) {
    const formData = new FormData();
    formData.append("avatar", file);

    // Show loading state
    showNotification("📤 Đang tải ảnh lên...", "info", 2000);

    fetch("/api/upload-avatar", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          uploadedAvatarPath = data.filePath;
          showNotification("✓ Ảnh đã được tải lên thành công!", "success");
          console.log("Avatar uploaded successfully:", data.filePath);
        } else {
          showNotification("❌ Lỗi tải ảnh: " + data.message, "error");
          resetAvatarUpload(); // Reset on failure
        }
      })
      .catch((error) => {
        console.error("Lỗi upload:", error);
        showNotification("❌ Lỗi kết nối khi tải ảnh!", "error");
        resetAvatarUpload(); // Reset on error
      });
  }

  // === Hàm xử lý thuốc theo danh mục ===
  function initMedicineCategory() {
    if (medicineCategorySelect && medicineNameInput) {
      medicineCategorySelect.addEventListener("change", function () {
        const category = this.value;
        if (category && medicinesByCategory[category]) {
          // Tạo datalist cho medicine name input
          let datalist = document.getElementById("medicine-suggestions");
          if (!datalist) {
            datalist = document.createElement("datalist");
            datalist.id = "medicine-suggestions";
            medicineNameInput.setAttribute("list", "medicine-suggestions");
            medicineNameInput.parentNode.appendChild(datalist);
          }

          datalist.innerHTML = "";
          medicinesByCategory[category].forEach((medicine) => {
            const option = document.createElement("option");
            option.value = medicine;
            datalist.appendChild(option);
          });
        }
      });

      // Xử lý thêm thuốc vào danh sách
      medicineNameInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          addMedicineToList();
        }
      });

      // Thêm nút thêm thuốc
      const addMedicineBtn = document.createElement("button");
      addMedicineBtn.type = "button";
      addMedicineBtn.className = "btn-add-medicine";
      addMedicineBtn.innerHTML = "+ Thêm";
      addMedicineBtn.onclick = addMedicineToList;
      medicineNameInput.parentNode.appendChild(addMedicineBtn);
    }
  }

  function addMedicineToList() {
    const medicineName = medicineNameInput.value.trim();
    const category = medicineCategorySelect.value;

    if (!medicineName || !category) {
      showNotification(
        "⚠️ Vui lòng chọn danh mục và nhập tên thuốc!",
        "warning"
      );
      return;
    }

    // Kiểm tra thuốc đã có chưa
    if (selectedMedicines.some((med) => med.name === medicineName)) {
      showNotification("⚠️ Thuốc này đã có trong danh sách!", "warning");
      return;
    }

    const medicine = {
      id: Date.now(),
      name: medicineName,
      category: category,
    };

    selectedMedicines.push(medicine);
    renderSelectedMedicines();
    medicineNameInput.value = "";
  }

  function renderSelectedMedicines() {
    if (!selectedMedicinesContainer) return;

    selectedMedicinesContainer.innerHTML = "";

    if (selectedMedicines.length === 0) {
      selectedMedicinesContainer.innerHTML =
        '<span class="no-medicines">Chưa có thuốc nào được chọn</span>';
      return;
    }

    selectedMedicines.forEach((medicine) => {
      const tag = document.createElement("div");
      tag.className = "medicine-tag";
      tag.innerHTML = `
        <span>${medicine.name}</span>
        <button type="button" class="remove-tag" onclick="removeMedicine(${medicine.id})">×</button>
      `;
      selectedMedicinesContainer.appendChild(tag);
    });
  }

  // Hàm xóa thuốc khỏi danh sách
  window.removeMedicine = function (medicineId) {
    selectedMedicines = selectedMedicines.filter(
      (med) => med.id !== medicineId
    );
    renderSelectedMedicines();
  };

  // === Cập nhật đồng hồ ===
  function updateTime() {
    const now = new Date();
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    if (dateTimeElement) {
      dateTimeElement.textContent = now.toLocaleDateString("vi-VN", options);
    }
  }
  updateTime();
  setInterval(updateTime, 60000);

  // === Hàm xử lý thuốc theo danh mục ===
  function initMedicineCategory() {
    if (medicineCategorySelect && medicineNameInput) {
      medicineCategorySelect.addEventListener("change", function () {
        const category = this.value;
        if (category && medicinesByCategory[category]) {
          // Tạo datalist cho medicine name input
          let datalist = document.getElementById("medicine-suggestions");
          if (!datalist) {
            datalist = document.createElement("datalist");
            datalist.id = "medicine-suggestions";
            medicineNameInput.setAttribute("list", "medicine-suggestions");
            medicineNameInput.parentNode.appendChild(datalist);
          }

          datalist.innerHTML = "";
          medicinesByCategory[category].forEach((medicine) => {
            const option = document.createElement("option");
            option.value = medicine;
            datalist.appendChild(option);
          });
        }
      });

      // Xử lý thêm thuốc vào danh sách
      medicineNameInput.addEventListener("keypress", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          addMedicineToList();
        }
      });

      // Thêm nút thêm thuốc
      const addMedicineBtn = document.createElement("button");
      addMedicineBtn.type = "button";
      addMedicineBtn.className = "btn-add-medicine";
      addMedicineBtn.innerHTML = "+ Thêm";
      addMedicineBtn.onclick = addMedicineToList;
      medicineNameInput.parentNode.appendChild(addMedicineBtn);
    }
  }

  function addMedicineToList() {
    const medicineName = medicineNameInput.value.trim();
    const category = medicineCategorySelect.value;

    if (!medicineName || !category) {
      showNotification(
        "⚠️ Vui lòng chọn danh mục và nhập tên thuốc!",
        "warning"
      );
      return;
    }

    // Kiểm tra thuốc đã có chưa
    if (selectedMedicines.some((med) => med.name === medicineName)) {
      showNotification("⚠️ Thuốc này đã có trong danh sách!", "warning");
      return;
    }

    const medicine = {
      id: Date.now(),
      name: medicineName,
      category: category,
    };

    selectedMedicines.push(medicine);
    renderSelectedMedicines();
    medicineNameInput.value = "";
  }

  function renderSelectedMedicines() {
    if (!selectedMedicinesContainer) return;

    selectedMedicinesContainer.innerHTML = "";

    if (selectedMedicines.length === 0) {
      selectedMedicinesContainer.innerHTML =
        '<span class="no-medicines">Chưa có thuốc nào được chọn</span>';
      return;
    }

    selectedMedicines.forEach((medicine) => {
      const tag = document.createElement("div");
      tag.className = "medicine-tag";
      tag.innerHTML = `
        <span>${medicine.name}</span>
        <button type="button" class="remove-tag" onclick="removeMedicine(${medicine.id})">×</button>
      `;
      selectedMedicinesContainer.appendChild(tag);
    });
  }

  // Khởi tạo các tính năng mới
  initAvatarUpload();
  initMedicineCategory();
  initCustomTimeInput();

  // === Hàm xử lý custom time input ===
  function initCustomTimeInput() {
    if (periodSelect && customTimeContainer) {
      periodSelect.addEventListener("change", function () {
        const selectedValue = this.value;

        if (selectedValue === "custom") {
          customTimeContainer.classList.remove("hidden");
          if (customTimeInput) {
            customTimeInput.required = true;

            // Set default time based on current hour
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const timeString = `${String(currentHour).padStart(
              2,
              "0"
            )}:${String(currentMinute).padStart(2, "0")}`;
            customTimeInput.value = timeString;
          }
        } else {
          customTimeContainer.classList.add("hidden");
          if (customTimeInput) {
            customTimeInput.required = false;
            customTimeInput.value = "";
          }
        }
      });
    }
  }

  // === Hàm tiện ích định dạng thời gian ===
  function formatCustomPeriod(period, customTime) {
    if (period === "custom" && customTime) {
      return `🕐 ${customTime}`;
    }
    return period;
  }

  function getPeriodDisplayText(period, customTime) {
    if (period === "custom" && customTime) {
      return `Tùy chỉnh (${customTime})`;
    }

    const periodTexts = {
      Sáng: "Sáng (khoảng 8:00)",
      Trưa: "Trưa (khoảng 12:00)",
      Chiều: "Chiều (khoảng 17:00)",
      Tối: "Tối (khoảng 20:00)",
    };

    return periodTexts[period] || period;
  }
  initCustomTimeInput();

  // === Các hàm render HTML ===
  function createAlertHTML(alert) {
    const icon = alert.type === "danger" ? "❌" : "⚠️";
    return `<li class="alert-item ${alert.type}"><span class="icon">${icon}</span><div>${alert.message}</div></li>`;
  }

  function createTimelineHTML(event) {
    return `
            <li class="timeline-item">
                <div class="timeline-time">${event.time}</div>
                <div class="timeline-content">
                    <div class="user">${event.user}</div>
                    <div class="medication">${event.medicine}</div>
                    <span class="timeline-status status-${
                      event.status
                    }">${event.status === "taken" ? "Đã uống" : "Đã bỏ lỡ"}</span>
                </div>
            </li>`;
  }

  // Enhanced schedule rendering with user and medicine data
  function renderScheduleList(schedules) {
    if (!scheduleList) return;
    scheduleList.innerHTML = "";
    if (!schedules || schedules.length === 0) {
      scheduleList.innerHTML =
        "<li class='no-data'>Không có lịch cài đặt nào.</li>";
      return;
    }

    // Sắp xếp lịch theo ngày và buổi (với custom time)
    schedules.sort((a, b) => {
      const dateA = a.date || "0000-00-00";
      const dateB = b.date || "0000-00-00";
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      const periodA = getPeriodSortValue(a.period, a.customTime);
      const periodB = getPeriodSortValue(b.period, b.customTime);
      return periodA - periodB;
    });

    schedules.forEach((item) => {
      // Get user and medicine details
      const user = localDataStore.users?.find((u) => u.id === item.userId);
      const medicine = localDataStore.medicines?.find(
        (m) => m.id === item.medicineId
      );

      let displayDate = "??/??";
      if (item.date) {
        const dateParts = item.date.split("-");
        if (dateParts.length === 3) {
          displayDate = `${dateParts[2]}/${dateParts[1]}`;
        }
      }

      const statusClass = item.status || "pending";
      const statusText =
        {
          pending: "Chưa uống",
          taken: "Đã uống",
          missed: "Đã bỏ lỡ",
        }[statusClass] || "Chưa xác định";

      scheduleList.innerHTML += `
        <li class="schedule-item status-${statusClass}">
          <div class="schedule-main">
            <div class="schedule-time">
              <strong class="date">${displayDate}</strong>
              <strong class="period">${formatCustomPeriod(
                item.period,
                item.customTime
              )}</strong>
            </div>
            <div class="schedule-details">
              <div class="user-info">👤 ${user?.name || "Unknown User"}</div>
              <div class="medicine-info">💊 ${
                medicine?.name || "Unknown Medicine"
              } ${medicine?.dosage ? `(${medicine.dosage})` : ""}</div>
              ${
                item.notes
                  ? `<div class="schedule-notes">📝 ${item.notes}</div>`
                  : ""
              }
            </div>
          </div>
          <div class="schedule-status">
            <span class="status-badge status-${statusClass}">${statusText}</span>
            ${
              statusClass === "pending"
                ? `
              <div class="schedule-actions">
                <button class="btn-action btn-taken" data-id="${item.id}" data-action="taken">✓ Đã uống</button>
                <button class="btn-action btn-missed" data-id="${item.id}" data-action="missed">✗ Bỏ lỡ</button>
              </div>
            `
                : ""
            }
            ${
              item.actualTime
                ? `<div class="actual-time">Thời gian: ${formatDateTime(
                    item.actualTime
                  )}</div>`
                : ""
            }
          </div>
        </li>
      `;
    });
  }

  function formatDateTime(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // *** CẬP NHẬT: Hiển thị Buổi trên Timeline với hỗ trợ custom time ***
  function renderUpcomingSchedule(schedules) {
    if (!timelineList) return;

    // Sắp xếp lịch theo buổi với custom time support
    schedules.sort((a, b) => {
      const periodA = getPeriodSortValue(a.period, a.customTime);
      const periodB = getPeriodSortValue(b.period, b.customTime);
      return periodA - periodB;
    });

    const todayString = getTodayString();

    schedules.forEach((item) => {
      if (item.date === todayString) {
        const displayPeriod = formatCustomPeriod(item.period, item.customTime);
        timelineList.innerHTML += `
                    <li class="timeline-item" data-status="pending" data-id="${item.id}" data-user="${item.user}">
                        <div class="timeline-time">${displayPeriod}</div> <div class="timeline-content">
                            <div class="user">${item.user}</div>
                            <div class="medication">${item.medicine}</div>
                            <span class="timeline-status status-pending">Sắp tới</span>
                            <div class="timeline-actions">
                              <button class="btn-action" data-action="remind">Gửi nhắc nhở IoT</button>
                              <button class="btn-action btn-stop" data-action="stop-alert">Dừng cảnh báo</button>
                              <button class="btn-action btn-test" data-action="test-iot">Test IoT</button>
                            </div>
                        </div>
                    </li>`;
      }
    });
  }

  // (Giữ nguyên hàm renderUserList)
  function renderUserList(users) {
    console.log("🔄 Rendering user list with data:", users);
    if (!userList) {
      console.warn("⚠️ userList element not found");
      return;
    }
    
    userList.innerHTML = "";
    
    if (!users || users.length === 0) {
      console.log("📝 No users found, showing empty message");
      userList.innerHTML = "<li class='no-data'>Không có người dùng nào.</li>";
      return;
    }

    console.log(`👥 Rendering ${users.length} users`);
    users.forEach((user, index) => {
      console.log(`Rendering user ${index + 1}:`, user);
      userList.innerHTML += `
                <li class="user-list-item" data-user-id="${user.id}">
                    <div class="user-list-info">
                        <img src="${user.avatar}" alt="Avatar" class="user-avatar" onerror="this.src='https://i.pravatar.cc/150?img=${user.id % 70}'">
                        <div class="user-details">
                          <span class="user-name">${user.name}</span>
                          <small class="user-created">Tạo: ${formatDate(user.createdAt)}</small>
                        </div>
                    </div>
                    <button class="btn-delete" data-id="${user.id}" title="Xóa người dùng">Xóa</button>
                </li>
            `;
    });
    
    console.log("✅ User list rendered successfully");
  }

  // (Giữ nguyên hàm renderUserDropdown)
  function renderUserDropdown(users) {
    console.log("🔄 Rendering user dropdown with data:", users);
    if (!userSelectDropdown) {
      console.warn("⚠️ userSelectDropdown element not found");
      return;
    }
    
    userSelectDropdown.innerHTML = "<option value=''>Chọn người dùng...</option>";
    
    if (!users || users.length === 0) {
      console.log("📝 No users found for dropdown");
      userSelectDropdown.innerHTML += "<option disabled>Chưa có người dùng</option>";
      return;
    }

    console.log(`👥 Adding ${users.length} users to dropdown`);
    users.forEach((user, index) => {
      console.log(`Adding user ${index + 1} to dropdown:`, user);
      userSelectDropdown.innerHTML += `
                <option value="${user.id}">${user.name}</option>
            `;
    });
    
    console.log("✅ User dropdown rendered successfully");
  }

  // Medicine inventory dashboard
  function renderInventoryDashboard(inventory, medicines) {
    const inventoryGrid = document.getElementById("inventory-grid");
    if (!inventoryGrid || !inventory || !medicines) return;

    inventoryGrid.innerHTML = "";

    if (medicines.length === 0) {
      inventoryGrid.innerHTML =
        '<div class="no-data">Chưa có thuốc nào trong tủ.</div>';
      return;
    }

    medicines.forEach((medicine) => {
      const isLowStock = inventory.lowStock.some(
        (item) => item.id === medicine.id
      );
      const isExpiringSoon = inventory.expiringSoon.some(
        (item) => item.id === medicine.id
      );
      const isExpired = inventory.expired.some(
        (item) => item.id === medicine.id
      );

      let statusClass = "adequate";
      let statusText = "Đủ dùng";
      let daysInfo = "";

      if (isExpired) {
        statusClass = "out";
        statusText = "Hết hạn";
      } else if (isLowStock) {
        statusClass = "low";
        statusText = "Sắp hết";
        const lowStockItem = inventory.lowStock.find(
          (item) => item.id === medicine.id
        );
        if (lowStockItem && lowStockItem.daysRemaining) {
          daysInfo = `Còn ${lowStockItem.daysRemaining} ngày`;
        }
      } else if (isExpiringSoon) {
        statusClass = "low";
        statusText = "Gần hết hạn";
        const expiringItem = inventory.expiringSoon.find(
          (item) => item.id === medicine.id
        );
        if (expiringItem) {
          daysInfo = `Hết hạn trong ${expiringItem.daysToExpiry} ngày`;
        }
      }

      const inventoryItem = document.createElement("div");
      inventoryItem.className = `inventory-item ${
        isLowStock || isExpiringSoon || isExpired ? statusClass : ""
      }`;

      inventoryItem.innerHTML = `
        <div class="inventory-header">
          <div class="inventory-name">${medicine.name}</div>
          <div class="inventory-status ${statusClass}">${statusText}</div>
        </div>
        <div class="inventory-details">
          <div>Số lượng: ${medicine.quantity} ${
        medicine.category === "vitamins" ? "viên" : "liều"
      }</div>
          <div>Liều dùng: ${medicine.dosage}</div>
          ${
            medicine.expiryDate
              ? `<div>HSD: ${formatDate(medicine.expiryDate)}</div>`
              : ""
          }
        </div>
        ${
          daysInfo
            ? `<div class="days-remaining ${statusClass}">${daysInfo}</div>`
            : ""
        }
      `;

      inventoryGrid.appendChild(inventoryItem);
    });
  }

  // Medicine management functions
  function renderMedicineList(medicines) {
    if (!medicineList) return;
    medicineList.innerHTML = "";
    if (!medicines || medicines.length === 0) {
      medicineList.innerHTML =
        "<li class='no-data'>Chưa có thuốc nào trong tủ.</li>";
      return;
    }

    medicines.forEach((medicine) => {
      const expiryWarning = checkExpiryStatus(medicine.expiryDate);
      const stockWarning = medicine.quantity <= medicine.minThreshold;

      medicineList.innerHTML += `
        <li class="medicine-list-item ${stockWarning ? "low-stock" : ""} ${
        expiryWarning.class
      }">
          <div class="medicine-info">
            <div class="medicine-header">
              <span class="medicine-name">💊 ${medicine.name}</span>
              <span class="medicine-dosage">${medicine.dosage}</span>
            </div>
            <div class="medicine-details">
              <span class="medicine-quantity">Còn lại: ${
                medicine.quantity
              } viên</span>
              ${
                medicine.expiryDate
                  ? `<span class="medicine-expiry">HSD: ${formatDate(
                      medicine.expiryDate
                    )}</span>`
                  : ""
              }
            </div>
            ${
              medicine.instructions
                ? `<div class="medicine-instructions">📝 ${medicine.instructions}</div>`
                : ""
            }
            ${
              expiryWarning.message
                ? `<div class="warning-message">${expiryWarning.message}</div>`
                : ""
            }
            ${
              stockWarning
                ? `<div class="warning-message">⚠️ Sắp hết thuốc!</div>`
                : ""
            }
          </div>
          <div class="medicine-actions">
            <button class="btn-edit" data-id="${medicine.id}">Sửa</button>
            <button class="btn-delete" data-id="${medicine.id}">Xóa</button>
          </div>
        </li>
      `;
    });
  }

  function renderMedicineDropdown(medicines) {
    if (!medicineSelectDropdown) return;
    medicineSelectDropdown.innerHTML =
      "<option value=''>Chọn thuốc...</option>";
    if (!medicines || medicines.length === 0) {
      medicineSelectDropdown.innerHTML +=
        "<option disabled>Chưa có thuốc nào</option>";
      return;
    }

    medicines.forEach((medicine) => {
      medicineSelectDropdown.innerHTML += `
        <option value="${medicine.id}">${medicine.name} (${medicine.dosage})</option>
      `;
    });
  }

  // Helper functions
  function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN");
  }

  function checkExpiryStatus(expiryDate) {
    if (!expiryDate) return { class: "", message: "" };

    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysToExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

    if (daysToExpiry <= 0) {
      return {
        class: "expired",
        message: "🚫 Thuốc đã hết hạn!",
      };
    } else if (daysToExpiry <= 7) {
      return {
        class: "expiring-soon",
        message: `⏰ Sẽ hết hạn trong ${daysToExpiry} ngày`,
      };
    } else if (daysToExpiry <= 30) {
      return {
        class: "expiring-month",
        message: `📅 Hết hạn trong ${daysToExpiry} ngày`,
      };
    }

    return { class: "", message: "" };
  }

  // Enhanced chart rendering with modern visualization
  function renderStatisticsChart(stats) {
    if (!stats || !chartCanvas) return;
    if (complianceChartInstance) {
      complianceChartInstance.destroy();
    }
    const ctx = chartCanvas.getContext("2d");

    // Modern gradient colors
    const gradient1 = ctx.createLinearGradient(0, 0, 0, 400);
    gradient1.addColorStop(0, "rgba(37, 99, 235, 0.8)");
    gradient1.addColorStop(1, "rgba(37, 99, 235, 0.2)");

    const gradient2 = ctx.createLinearGradient(0, 0, 0, 400);
    gradient2.addColorStop(0, "rgba(5, 150, 105, 0.8)");
    gradient2.addColorStop(1, "rgba(5, 150, 105, 0.2)");

    complianceChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: stats.labels,
        datasets: [
          {
            label: "👨 Ông (User 1)",
            data: stats.dailyBreakdown.user1,
            backgroundColor: gradient1,
            borderColor: "rgba(37, 99, 235, 1)",
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false,
          },
          {
            label: "👩 Bà (User 2)",
            data: stats.dailyBreakdown.user2,
            backgroundColor: gradient2,
            borderColor: "rgba(5, 150, 105, 1)",
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: "index",
        },
        plugins: {
          legend: {
            position: "top",
            labels: {
              color: "#1e293b",
              font: {
                size: 14,
                weight: "600",
              },
              usePointStyle: true,
              pointStyle: "circle",
            },
          },
          tooltip: {
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            titleColor: "#1e293b",
            bodyColor: "#64748b",
            borderColor: "#e2e8f0",
            borderWidth: 1,
            cornerRadius: 8,
            displayColors: true,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: "📊 Số liều đã uống",
              color: "#64748b",
              font: { size: 12, weight: "600" },
            },
            ticks: {
              color: "#64748b",
              font: { size: 11 },
            },
            grid: {
              color: "rgba(148, 163, 184, 0.2)",
              borderDash: [2, 2],
            },
          },
          x: {
            title: {
              display: true,
              text: "🗺 Ngày trong tuần",
              color: "#64748b",
              font: { size: 12, weight: "600" },
            },
            ticks: {
              color: "#64748b",
              font: { size: 11, weight: "500" },
            },
            grid: {
              color: "rgba(148, 163, 184, 0.2)",
              borderDash: [2, 2],
            },
          },
        },
        animation: {
          duration: 1500,
          easing: "easeInOutCubic",
        },
      },
    });
  }

  // === LẮNG NGHE SỰ KIỆN TỪ SERVER ===

  // 1. Nhận dữ liệu ban đầu
  socket.on("initialData", (data) => {
    console.log("Nhận được dữ liệu ban đầu:", data);
    localDataStore = data;

    // Cập nhật system status với data structure mới
    if (deviceStatus)
      deviceStatus.textContent = data.system?.status || "Offline";
    if (deviceStatus)
      deviceStatus.className = `value ${(
        data.system?.status || "offline"
      ).toLowerCase()}`;
    if (deviceTemp)
      deviceTemp.textContent = `${data.system?.temperature || "--"} °C`;
    if (deviceHumidity)
      deviceHumidity.textContent = `${data.system?.humidity || "--"} %`;

    if (alertList) {
      alertList.innerHTML = "";
      if (data.alerts && data.alerts.length > 0) {
        data.alerts.forEach((alert) => {
          alertList.innerHTML += createAlertHTML(alert);
        });
      } else {
        alertList.innerHTML = `<li class="no-alerts"><span class="icon">✅</span><div>Không có cảnh báo nào!</div></li>`;
      }
    }

    if (timelineList) {
      timelineList.innerHTML = "";
      if (data.timeline && data.timeline.length > 0) {
        data.timeline
          .slice()
          .reverse()
          .forEach((event) => {
            timelineList.insertAdjacentHTML(
              "afterbegin",
              createTimelineHTML(event)
            );
          });
      }
      if (data.fullSchedule) {
        renderUpcomingSchedule(data.fullSchedule);
      }
    }

    // Fix statistics display
    if (data.statistics && data.statistics.compliance) {
      const userKeys = Object.keys(data.statistics.compliance);
      if (userKeys.length >= 1 && statUser1) {
        const user1Stats = data.statistics.compliance[userKeys[0]] || 0;
        statUser1.textContent = `${user1Stats}%`;
        if (statBar1) statBar1.style.width = `${user1Stats}%`;
      }
      if (userKeys.length >= 2 && statUser2) {
        const user2Stats = data.statistics.compliance[userKeys[1]] || 0;
        statUser2.textContent = `${user2Stats}%`;
        if (statBar2) statBar2.style.width = `${user2Stats}%`;
      }
    }

    // Render all components với logging để debug
    console.log("🔄 Rendering initial data components...");
    console.log("📊 Users data:", data.users);
    console.log("💊 Medicines data:", data.medicines);
    console.log("📅 Schedules data:", data.schedules);
    
    renderScheduleList(data.schedules || []);
    renderUserList(data.users || []);
    renderUserDropdown(data.users || []);
    renderMedicineList(data.medicines || []);
    renderMedicineDropdown(data.medicines || []);
    renderInventoryDashboard(data.inventory, data.medicines || []);
    renderStatisticsChart(data.statistics);

    // Update UI counters
    const userCount = document.getElementById("user-count");
    if (userCount) userCount.textContent = (data.users || []).length;

    const medicineCount = document.getElementById("medicine-count");
    if (medicineCount) medicineCount.textContent = (data.medicines || []).length;

    const alertCount = document.getElementById("alert-count");
    if (alertCount) {
      const unreadAlerts = (data.alerts || []).filter(alert => !alert.isRead);
      alertCount.textContent = unreadAlerts.length;
    }

    console.log("✅ Initial data rendering completed!");
    showNotification("🎯 Hệ thống đã khởi động thành công!", "success", 3000);
  });

  // Enhanced IoT status updates with visual feedback
  socket.on("iotStatusUpdate", (data) => {
    console.log("Nhận cập nhật trạng thái IoT:", data);

    // Update with smooth transitions
    if (deviceStatus) {
      const oldStatus = deviceStatus.textContent;
      deviceStatus.textContent = data.status;
      deviceStatus.className = `value ${data.status.toLowerCase()}`;

      if (oldStatus !== data.status) {
        deviceStatus.style.transform = "scale(1.1)";
        setTimeout(() => {
          deviceStatus.style.transform = "scale(1)";
        }, 200);
      }
    }

    if (deviceTemp) {
      const oldTemp = deviceTemp.textContent;
      deviceTemp.textContent = `${data.nhietDo} °C`;

      if (oldTemp !== deviceTemp.textContent) {
        deviceTemp.style.color = "#3b82f6";
        setTimeout(() => {
          deviceTemp.style.color = "";
        }, 1000);
      }
    }

    if (deviceHumidity) {
      const oldHumidity = deviceHumidity.textContent;
      deviceHumidity.textContent = `${data.doAm} %`;

      if (oldHumidity !== deviceHumidity.textContent) {
        deviceHumidity.style.color = "#06b6d4";
        setTimeout(() => {
          deviceHumidity.style.color = "";
        }, 1000);
      }
    }

    // Show notification for significant changes
    if (data.status === "offline") {
      showNotification("⚠️ Tủ thuốc mất kết nối!", "warning");
    } else if (data.status === "online") {
      showNotification("✅ Tủ thuốc đã kết nối trở lại!", "success");
    }
  });

  // Enhanced timeline updates with animations
  socket.on("newTimelineEvent", (event) => {
    console.log("Nhận sự kiện timeline mới:", event);
    if (localDataStore.timeline) {
      localDataStore.timeline.push(event);
    }
    if (timelineList) {
      // Create new item with animation
      const newItemHTML = createTimelineHTML(event);
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = newItemHTML;
      const newItem = tempDiv.firstElementChild;

      // Initial state for animation
      newItem.style.opacity = "0";
      newItem.style.transform = "translateY(-20px)";
      newItem.style.transition = "opacity 0.5s ease, transform 0.5s ease";

      timelineList.insertBefore(newItem, timelineList.firstChild);

      // Trigger animation
      requestAnimationFrame(() => {
        newItem.style.opacity = "1";
        newItem.style.transform = "translateY(0)";
      });

      // Remove pending item with fade out
      const pendingItem = timelineList.querySelector(`[data-id="${event.id}"]`);
      if (pendingItem && pendingItem !== newItem) {
        pendingItem.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        pendingItem.style.opacity = "0";
        pendingItem.style.transform = "translateX(20px)";
        setTimeout(() => pendingItem.remove(), 300);
      }

      // Show success notification
      showNotification("✅ Cập nhật hoạt động mới!", "success");
    }
  });

  // Enhanced alert system with animations
  socket.on("newAlert", (alert) => {
    console.log("Nhận cảnh báo mới:", alert);
    if (alertList) {
      // Create alert with animation
      const alertHTML = createAlertHTML(alert);
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = alertHTML;
      const newAlert = tempDiv.firstElementChild;

      // Initial animation state
      newAlert.style.opacity = "0";
      newAlert.style.transform = "translateX(-20px)";
      newAlert.style.transition = "opacity 0.5s ease, transform 0.5s ease";

      alertList.insertBefore(newAlert, alertList.firstChild);

      // Trigger animation
      requestAnimationFrame(() => {
        newAlert.style.opacity = "1";
        newAlert.style.transform = "translateX(0)";
      });

      // Show notification
      const notificationType = alert.type === "danger" ? "error" : "warning";
      showNotification(alert.message, notificationType);

      // Auto-highlight effect
      newAlert.style.boxShadow = "0 0 20px rgba(217, 119, 6, 0.4)";
      setTimeout(() => {
        newAlert.style.boxShadow = "";
      }, 2000);
    }
  });

  // 5. Enhanced action response handling
  socket.on("actionResponse", (response) => {
    if (response.success) {
      showNotification(response.message, "success");

      // Reset forms on success
      if (response.message.includes("thuốc")) {
        if (addMedicineForm) addMedicineForm.reset();
      } else if (response.message.includes("lịch")) {
        if (addScheduleForm) {
          addScheduleForm.reset();
          selectedMedicines = []; // Clear selected medicines
          renderSelectedMedicines();
        }
      } else if (response.message.includes("người dùng")) {
        if (addUserForm) {
          addUserForm.reset();
          resetAvatarUpload(); // Clear avatar upload state
        }
      }
    } else {
      showNotification(response.message || "Đã xảy ra lỗi", "error");
    }

    // Re-enable buttons
    setTimeout(() => {
      const buttons = document.querySelectorAll(".btn-submit");
      buttons.forEach((btn) => {
        btn.disabled = false;
        if (btn.innerHTML.includes("Đang lưu")) {
          if (btn.innerHTML.includes("thuốc"))
            btn.innerHTML = "<span>✓ Lưu thuốc</span>";
          else if (btn.innerHTML.includes("lịch"))
            btn.innerHTML = "<span>✓ Lưu lịch</span>";
          else btn.innerHTML = "<span>✓ Lưu người dùng</span>";
        }
      });
    }, 1000);
  });

  // Medicine updates
  socket.on("medicinesUpdated", (medicines) => {
    console.log("Cập nhật danh sách thuốc:", medicines);
    localDataStore.medicines = medicines;
    renderMedicineList(medicines);
    renderMedicineDropdown(medicines);
    renderInventoryDashboard(localDataStore.inventory, medicines);

    const medicineCount = document.getElementById("medicine-count");
    if (medicineCount) medicineCount.textContent = medicines.length;
  });

  // Enhanced schedule updates with better UX
  socket.on("scheduleUpdated", (allSchedules) => {
    console.log("Lịch cài đặt đã được cập nhật:", allSchedules);
    localDataStore.schedules = allSchedules;

    renderScheduleList(allSchedules);

    if (timelineList && localDataStore.timeline) {
      timelineList.innerHTML = "";
      localDataStore.timeline
        .slice()
        .reverse()
        .forEach((event) => {
          timelineList.insertAdjacentHTML(
            "afterbegin",
            createTimelineHTML(event)
          );
        });
      renderUpcomingSchedule(allSchedules);
    }

    if (addScheduleForm) {
      const submitButton = addScheduleForm.querySelector(".btn-submit");
      if (submitButton) {
        // Success animation
        submitButton.style.background =
          "linear-gradient(135deg, #10b981 0%, #059669 100%)";
        submitButton.innerHTML = "✓ Đã lưu!";

        setTimeout(() => {
          submitButton.disabled = false;
          submitButton.innerHTML = "✓ Lưu lịch hẹn";
          submitButton.style.background = "";
        }, 1500);
      }

      // Smooth form reset
      setTimeout(() => {
        addScheduleForm.reset();

        // Reset to current time context
        const now = new Date();
        const currentHour = now.getHours();
        if (dateInput) dateInput.value = getTodayString();
        if (periodSelect) {
          if (currentHour < 10) periodSelect.value = "Sáng";
          else if (currentHour < 14) periodSelect.value = "Trưa";
          else if (currentHour < 19) periodSelect.value = "Chiều";
          else periodSelect.value = "Tối";
        }
      }, 500);
    }
  });

  // 7. Lắng nghe cập nhật Thống kê
  socket.on("statsUpdate", (data) => {
    // (Giữ nguyên)
    console.log("Nhận cập nhật thống kê:", data);
    localDataStore.statistics = data;
    if (statUser1) statUser1.textContent = `${data.compliance.user1}%`;
    if (statBar1) statBar1.style.width = `${data.compliance.user1}%`;
    if (statUser2)
      statUser2.textContent = `${data.statistics.compliance.user2}%`;
    if (statBar2) statBar2.style.width = `${data.statistics.compliance.user2}%`;

    const statsPage = document.getElementById("page-stats");
    if (statsPage && statsPage.style.display === "block") {
      renderStatisticsChart(data);
    }
  });

  // Timeline updates
  socket.on("timelineUpdated", (timeline) => {
    console.log("Cập nhật timeline:", timeline);
    localDataStore.timeline = timeline;

    if (timelineList) {
      timelineList.innerHTML = "";
      timeline
        .slice()
        .reverse()
        .forEach((event) => {
          timelineList.insertAdjacentHTML(
            "afterbegin",
            createTimelineHTML(event)
          );
        });
    }
  });

  // Alerts updates
  socket.on("alertsUpdated", (alerts) => {
    console.log("Cập nhật cảnh báo:", alerts);
    localDataStore.alerts = alerts;

    if (alertList) {
      alertList.innerHTML = "";
      if (alerts.length === 0) {
        alertList.innerHTML = `<li class="no-alerts"><span class="icon">✅</span><div>Không có cảnh báo nào!</div></li>`;
      } else {
        alerts.forEach((alert) => {
          alertList.innerHTML += createAlertHTML(alert);
        });
      }
    }

    const alertCount = document.getElementById("alert-count");
    if (alertCount)
      alertCount.textContent = alerts.filter((a) => !a.isRead).length;
  });

  // Enhanced reminder alerts with IoT status
  socket.on("reminderAlert", (reminderData) => {
    const iotStatus = reminderData.iotTriggered
      ? "✅ IoT đã kích hoạt"
      : "❌ IoT lỗi";
    const message = `${reminderData.message} ${iotStatus}`;
    showNotification(
      message,
      reminderData.iotTriggered ? "success" : "warning",
      7000
    );
    console.log("Nhắc nhở với IoT:", reminderData);
  });

  // IoT connection test results
  socket.on("iotConnectionTest", (testResult) => {
    const type = testResult.success ? "success" : "error";
    showNotification(testResult.message, type, 5000);

    console.log("IoT Connection Test:", testResult);
    if (testResult.config) {
      console.log("E-Ra Config:", testResult.config);
    }
  });

  // Statistics updates
  socket.on("statsUpdate", (statistics) => {
    console.log("Cập nhật thống kê:", statistics);
    localDataStore.statistics = statistics;
    renderStatisticsChart(statistics);

    if (statUser1) {
      const user1Stats = Object.values(statistics.compliance)[0] || 0;
      statUser1.textContent = `${user1Stats}%`;
      if (statBar1) statBar1.style.width = `${user1Stats}%`;
    }

    if (statUser2) {
      const user2Stats = Object.values(statistics.compliance)[1] || 0;
      statUser2.textContent = `${user2Stats}%`;
      if (statBar2) statBar2.style.width = `${user2Stats}%`;
    }
  });

  // Error handling
  socket.on("error", (errorData) => {
    console.error("Server error:", errorData);
    showNotification(
      `Lỗi: ${errorData.message} (${errorData.context})`,
      "error",
      5000
    );
  });

  // Enhanced user management with smooth updates
  socket.on("userListUpdated", (users) => {
    console.log("Danh sách người dùng đã được cập nhật:", users);
    localDataStore.users = users;

    // Smooth list updates
    renderUserList(users);
    renderUserDropdown(users);

    // Modern notification
    showNotification("✅ Đã cập nhật danh sách người dùng!", "success");

    if (addUserForm) {
      const submitButton = addUserForm.querySelector(".btn-submit");
      if (submitButton) {
        // Success animation
        submitButton.style.background =
          "linear-gradient(135deg, #10b981 0%, #059669 100%)";
        submitButton.innerHTML = "✓ Đã thêm!";

        setTimeout(() => {
          submitButton.disabled = false;
          submitButton.innerHTML = "✓ Lưu người dùng";
          submitButton.style.background = "";
        }, 1500);
      }

      setTimeout(() => {
        addUserForm.reset();
        resetAvatarUpload(); // Clear avatar upload state
      }, 500);
    }
  });

  // === GỬI SỰ KIỆN LÊN SERVER ===

  // Enhanced reminder functionality with visual feedback
  if (timelineList) {
    timelineList.addEventListener("click", function (e) {
      const button = e.target.closest(".btn-action");
      if (button) {
        const item = button.closest(".timeline-item");
        const user = item.dataset.user;
        const action = button.dataset.action;

        if (action === "remind") {
          // Visual feedback
          button.innerHTML = "🔔 Đang gửi IoT...";
          button.disabled = true;
          button.style.opacity = "0.7";

          // Add loading animation to timeline item
          item.style.transform = "scale(0.98)";
          item.style.transition = "transform 0.3s ease";

          socket.emit("sendReminder", { userId: item.dataset.id, user: user });

          setTimeout(() => {
            button.innerHTML = "🔔 Gửi nhắc nhở IoT";
            button.disabled = false;
            button.style.opacity = "1";
            item.style.transform = "scale(1)";

            // Success animation
            button.style.background =
              "linear-gradient(135deg, #10b981 0%, #059669 100%)";
            setTimeout(() => {
              button.style.background = "";
            }, 1000);
          }, 2000);
        } else if (action === "stop-alert") {
          // Stop IoT alert
          button.innerHTML = "🔕 Đang dừng...";
          button.disabled = true;
          button.style.opacity = "0.7";

          socket.emit("stopIoTAlert", { user: user });

          setTimeout(() => {
            button.innerHTML = "🔕 Dừng cảnh báo";
            button.disabled = false;
            button.style.opacity = "1";

            // Success animation
            button.style.background =
              "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
            setTimeout(() => {
              button.style.background = "";
            }, 1000);
          }, 1500);
        } else if (action === "test-iot") {
          // Test IoT connection
          button.innerHTML = "🔧 Đang test...";
          button.disabled = true;
          button.style.opacity = "0.7";

          socket.emit("testIoTConnection");

          setTimeout(() => {
            button.innerHTML = "🔧 Test IoT";
            button.disabled = false;
            button.style.opacity = "1";

            // Info animation
            button.style.background =
              "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)";
            setTimeout(() => {
              button.style.background = "";
            }, 1000);
          }, 2000);
        }
      }
    });
  }

  // 2. Medicine Management Form
  if (addMedicineForm) {
    addMedicineForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const submitButton = addMedicineForm.querySelector(".btn-submit");
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Đang lưu... ⏳";
      }

      const formData = new FormData(addMedicineForm);
      const medicineData = {
        name: formData.get("medicineName").trim(),
        dosage: formData.get("dosage").trim(),
        instructions: formData.get("instructions").trim(),
        quantity: parseInt(formData.get("quantity")) || 0,
        minThreshold: parseInt(formData.get("minThreshold")) || 5,
        expiryDate: formData.get("expiryDate") || null,
      };

      if (!medicineData.name || !medicineData.dosage) {
        showNotification("Vui lòng nhập tên thuốc và liều lượng!", "error");
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = "<span>✓ Lưu thuốc</span>";
        }
        return;
      }

      socket.emit("saveNewMedicine", medicineData);
    });
  }

  // 3. Schedule Form - Cập nhật với thứ trong tuần và thời gian sử dụng
  if (addScheduleForm) {
    addScheduleForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const submitButton = addScheduleForm.querySelector(".btn-submit");
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Đang lưu... ⏳";
      }

      const formData = new FormData(addScheduleForm);

      // Lấy thứ đã chọn
      const selectedWeekdays = [];
      const weekdayInputs = addScheduleForm.querySelectorAll(
        'input[name="weekdays"]:checked'
      );
      weekdayInputs.forEach((input) => {
        selectedWeekdays.push(parseInt(input.value));
      });

      const scheduleData = {
        userId: parseInt(formData.get("user")),
        weekdays: selectedWeekdays,
        period: formData.get("period"),
        customTime: formData.get("customTime") || null,
        usageDuration: parseInt(formData.get("usageDuration")),
        medicines: selectedMedicines,
        notes: formData.get("notes") || "",
      };

      // Validation for custom time
      if (scheduleData.period === "custom" && !scheduleData.customTime) {
        showNotification("⚠️ Vui lòng nhập thời gian tùy chỉnh!", "error");
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = "<span>✓ Lưu lịch uống thuốc</span>";
        }
        return;
      }

      if (
        !scheduleData.userId ||
        selectedWeekdays.length === 0 ||
        !scheduleData.period ||
        !scheduleData.usageDuration ||
        selectedMedicines.length === 0
      ) {
        showNotification("Vui lòng điền đầy đủ thông tin!", "error");
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = "<span>✓ Lưu lịch uống thuốc</span>";
        }
        return;
      }

      socket.emit("saveNewSchedule", scheduleData);
    });
  }

  // 3. Gửi Người dùng mới với avatar upload
  if (addUserForm) {
    addUserForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const submitButton = addUserForm.querySelector(".btn-submit");
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Đang lưu... ⏳";
      }

      const formData = new FormData(addUserForm);
      const userName = formData.get("userName");
      const avatarUrl = formData.get("avatarUrl");

      const data = {
        name: userName,
        avatar: uploadedAvatarPath || avatarUrl || null,
      };

      if (!data.name || !data.name.trim()) {
        showNotification("⚠️ Vui lòng nhập tên người dùng!", "error");
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = "<span>✓ Lưu người dùng</span>";
        }
        return;
      }

      console.log("Submitting user data:", data);
      socket.emit("saveNewUser", data);
    });
  }

  // 4. Schedule Status Updates
  if (scheduleList) {
    scheduleList.addEventListener("click", function (e) {
      const actionButton = e.target.closest(".btn-action");
      if (actionButton) {
        const scheduleId = actionButton.dataset.id;
        const action = actionButton.dataset.action;

        if (scheduleId && action) {
          socket.emit("updateScheduleStatus", {
            scheduleId: parseInt(scheduleId),
            status: action,
          });
        }
      }
    });
  }

  // 5. Medicine Management Actions
  if (medicineList) {
    medicineList.addEventListener("click", function (e) {
      const deleteButton = e.target.closest(".btn-delete");
      if (deleteButton) {
        const medicineId = deleteButton.dataset.id;
        if (confirm("Bạn có chắc muốn xóa thuốc này?")) {
          socket.emit("deleteMedicine", { id: Number(medicineId) });
        }
      }

      const editButton = e.target.closest(".btn-edit");
      if (editButton) {
        const medicineId = editButton.dataset.id;
        // TODO: Implement edit functionality
        showNotification("Chức năng sửa thuốc đang được phát triển", "info");
      }
    });
  }

  // 6. User Management
  if (userList) {
    userList.addEventListener("click", function (e) {
      const deleteButton = e.target.closest(".btn-delete");
      if (deleteButton) {
        const userId = deleteButton.dataset.id;
        if (
          confirm(
            "Bạn có chắc muốn xóa người dùng này? (Hành động này không thể hoàn tác)"
          )
        ) {
          socket.emit("deleteUser", { id: Number(userId) });
        }
      }
    });
  }
});
