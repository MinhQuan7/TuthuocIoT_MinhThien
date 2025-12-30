document.addEventListener("DOMContentLoaded", function () {
  // CẤU HÌNH GOOGLE APPS SCRIPT (Điền URL Web App sau khi deploy script)
  const GOOGLE_APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxwGPpBwIzg4zGg5s0s9xqzaVbmR0XPM6BHDKRmI9QOQkrAfzCcUq2Sky9jHpAQGyrO/exec"; // Ví dụ: "https://script.google.com/macros/s/AKfycbx.../exec"

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
  const alertExpandContainer = document.getElementById(
    "alert-expand-container"
  );
  const alertExpandBtn = document.getElementById("alert-expand-btn");
  const clearAlertsBtn = document.getElementById("clear-alerts-btn");
  let isAlertsExpanded = false;

  if (alertExpandBtn) {
    alertExpandBtn.addEventListener("click", () => {
      isAlertsExpanded = !isAlertsExpanded;
      alertExpandBtn.textContent = isAlertsExpanded ? "Thu gọn" : "Xem thêm";
      if (localDataStore && localDataStore.alerts) {
        renderAlertsList(localDataStore.alerts);
      }
    });
  }

  if (clearAlertsBtn) {
    clearAlertsBtn.addEventListener("click", () => {
      if (confirm("Bạn có chắc chắn muốn xóa tất cả cảnh báo không?")) {
        socket.emit("clearAlerts");
      }
    });
  }

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
      success: "",
      error: "",
      warning: "",
      info: "",
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

      // *** CẬP NHẬT: Modal yêu cầu chụp ảnh cho trang User ***
      if (targetPageId === "page-users") {
        const modal = document.getElementById("photo-requirement-modal");
        if (modal) {
          modal.classList.remove("hidden");
        }
        // Initialize button state
        updateSubmitButtonState();
      }
    });
  });

  // === Modal Logic ===
  const modalConfirmBtn = document.getElementById("modal-confirm-btn");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const photoModal = document.getElementById("photo-requirement-modal");

  if (modalConfirmBtn) {
    modalConfirmBtn.addEventListener("click", () => {
      if (photoModal) photoModal.classList.add("hidden");
    });
  }

  if (modalCancelBtn) {
    modalCancelBtn.addEventListener("click", () => {
      if (photoModal) photoModal.classList.add("hidden");
      // Switch back to dashboard
      const dashboardLink = document.querySelector(
        '[data-page="page-dashboard"]'
      );
      if (dashboardLink) dashboardLink.click();
    });
  }

  // === Hàm xử lý upload avatar (Multiple) ===
  function initAvatarUpload() {
    // Camera elements
    const startCameraBtn = document.getElementById("start-camera-btn");
    const cameraInterface = document.getElementById("camera-interface");
    const cameraFeed = document.getElementById("camera-feed");
    const captureBtn = document.getElementById("capture-btn");
    const closeCameraBtn = document.getElementById("close-camera-btn");
    const cameraCanvas = document.getElementById("camera-canvas");
    let stream = null;

    // Camera functionality
    if (startCameraBtn) {
      startCameraBtn.addEventListener("click", async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
          });
          cameraFeed.srcObject = stream;
          cameraInterface.classList.remove("hidden");
          startCameraBtn.classList.add("hidden");
        } catch (err) {
          console.error("Error accessing camera:", err);
          showNotification(
            "Không thể truy cập camera! Vui lòng kiểm tra quyền truy cập.",
            "error"
          );
        }
      });
    }

    if (closeCameraBtn) {
      closeCameraBtn.addEventListener("click", () => {
        stopCamera();
      });
    }

    if (captureBtn) {
      captureBtn.addEventListener("click", () => {
        if (!stream) return;

        // Set canvas dimensions to match video
        cameraCanvas.width = cameraFeed.videoWidth;
        cameraCanvas.height = cameraFeed.videoHeight;

        // Draw video frame to canvas
        const ctx = cameraCanvas.getContext("2d");
        ctx.drawImage(
          cameraFeed,
          0,
          0,
          cameraCanvas.width,
          cameraCanvas.height
        );

        // Convert to file
        cameraCanvas.toBlob(
          (blob) => {
            const fileName = `capture_${Date.now()}.jpg`;
            const file = new File([blob], fileName, { type: "image/jpeg" });

            // Reuse existing upload logic
            handleFiles([file]);

            // Show feedback
            showNotification("Đã chụp ảnh thành công!", "success", 1000);

            // Keep camera open for next shot
            // stopCamera();
          },
          "image/jpeg",
          0.9
        );
      });
    }

    function stopCamera() {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }
      cameraFeed.srcObject = null;
      cameraInterface.classList.add("hidden");
      if (startCameraBtn) startCameraBtn.classList.remove("hidden");
    }

    // Helper to handle files (extracted from change event)
    function handleFiles(files) {
      const previewContainer = document.getElementById(
        "avatar-preview-container"
      );
      const removeBtn = document.getElementById("remove-avatar");

      if (files && files.length > 0) {
        // Don't clear old previews if appending, but here we might want to append
        // For now, let's keep behavior consistent: clear or append?
        // The original code cleared it. Let's append if it's from camera?
        // Actually, the original code cleared: previewContainer.innerHTML = "";
        // Let's modify to append if we want multiple photos from camera.

        // If it's the first time (hidden), clear.
        if (previewContainer.classList.contains("hidden")) {
          previewContainer.innerHTML = "";
          previewContainer.classList.remove("hidden");
        }

        if (removeBtn) removeBtn.classList.remove("hidden");

        let validFiles = [];
        Array.from(files).forEach((file) => {
          if (file.type.startsWith("image/")) {
            validFiles.push(file);
            const reader = new FileReader();
            reader.onload = function (e) {
              const img = document.createElement("img");
              img.src = e.target.result;
              previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
          }
        });

        if (validFiles.length > 0) {
          // Upload files to server
          uploadAvatarFiles(validFiles);
        } else {
          showNotification("Vui lòng chọn file ảnh!", "error");
        }
      }
    }

    if (avatarFileInput) {
      avatarFileInput.addEventListener("change", function (e) {
        handleFiles(e.target.files);
      });
    }

    if (removeAvatarBtn) {
      removeAvatarBtn.addEventListener("click", function () {
        resetAvatarUpload();
        showNotification("Đã xóa ảnh đã chọn!", "info");
      });
    }
  }

  // Function to completely reset avatar upload state
  function resetAvatarUpload() {
    if (avatarFileInput) avatarFileInput.value = "";

    const previewContainer = document.getElementById(
      "avatar-preview-container"
    );
    const removeBtn = document.getElementById("remove-avatar");

    if (previewContainer) {
      previewContainer.innerHTML = "";
      previewContainer.classList.add("hidden");
    }
    if (removeBtn) removeBtn.classList.add("hidden");

    uploadedAvatarPaths = []; // Reset array
    updateSubmitButtonState(); // Update button state

    // Clear URL input as well
    const avatarUrlInput = document.getElementById("user-avatar-input");
    if (avatarUrlInput) avatarUrlInput.value = "";

    console.log("Avatar upload state reset");
  }

  let uploadedAvatarPaths = []; // Store array of paths

  // Function to update submit button state based on photo count
  function updateSubmitButtonState() {
    const submitBtn = document.querySelector("#add-user-form .btn-submit");
    if (!submitBtn) return;

    const photoCount = uploadedAvatarPaths.length;
    const requiredCount = 5;

    if (photoCount >= requiredCount) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = "<span>Lưu người dùng</span>";
      submitBtn.style.background = ""; // Reset to default CSS
      submitBtn.title = "";
    } else {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Cần thêm ${
        requiredCount - photoCount
      } ảnh nữa</span>`;
      submitBtn.title = "Vui lòng tải lên đủ 5 ảnh để tiếp tục";
    }
  }

  // === Hàm upload ảnh lên Google Drive ===
  async function uploadToGoogleDrive(file) {
    if (!GOOGLE_APPS_SCRIPT_URL) {
      return;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result.split(",")[1];
        const payload = {
          base64: base64Data,
          filename: file.name,
          mimeType: file.type,
        };

        try {
          const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload),
          });

          if (!response.ok) throw new Error("Network response was not ok");
          const data = await response.json();
          resolve(data);
        } catch (error) {
          console.error("Google Drive Upload Error:", error);
          resolve(null);
        }
      };
      reader.onerror = (error) => resolve(null);
    });
  }

  function uploadAvatarFiles(files) {
    // Trigger Google Drive Upload in background
    if (GOOGLE_APPS_SCRIPT_URL) {
      console.log("Bắt đầu upload backup lên Google Drive...");
      files.forEach((file) => {
        uploadToGoogleDrive(file).then((res) => {
          if (res && res.status === "success") {
            console.log(`Đã backup lên Drive: ${res.fileUrl}`);
          }
        });
      });
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("avatars", file);
    });

    // Show loading state
    showNotification(`Đang tải ${files.length} ảnh lên...`, "info", 2000);

    fetch("/api/upload-avatars", {
      // Changed endpoint
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // Append new paths to existing array instead of replacing
          uploadedAvatarPaths = [...uploadedAvatarPaths, ...data.filePaths];

          updateSubmitButtonState(); // Update button state

          showNotification(
            `${data.filePaths.length} ảnh đã được tải lên thành công! (Tổng: ${uploadedAvatarPaths.length})`,
            "success"
          );
          console.log("Avatar uploaded successfully:", data.filePath);
        } else {
          showNotification("Lỗi tải ảnh: " + data.message, "error");
          // Don't reset all on partial failure, just don't add
        }
      })
      .catch((error) => {
        console.error("Lỗi upload:", error);
        showNotification("Lỗi kết nối khi tải ảnh!", "error");
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
      showNotification("Vui lòng chọn danh mục và nhập tên thuốc!", "warning");
      return;
    }

    // Kiểm tra thuốc đã có chưa
    if (selectedMedicines.some((med) => med.name === medicineName)) {
      showNotification("Thuốc này đã có trong danh sách!", "warning");
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
    // Reset category select to default to avoid validation error on next add if user forgets
    // But for the form submission validation, we need to check selectedMedicines length, not the input fields.
    // medicineCategorySelect.value = "";
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

  // Hàm xóa thuốc khỏi hệ thống (Inventory)
  window.deleteMedicine = function (medicineId) {
    if (
      confirm(
        "Bạn có chắc chắn muốn xóa thuốc này khỏi hệ thống? Hành động này không thể hoàn tác."
      )
    ) {
      socket.emit("deleteMedicine", medicineId);
    }
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
      return `${customTime}`;
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
    const icon = alert.type === "danger" ? "" : "";
    return `<li class="alert-item ${alert.type}"><span class="icon">${icon}</span><div>${alert.message}</div></li>`;
  }

  function renderAlertsList(alerts) {
    if (!alertList) return;
    alertList.innerHTML = "";

    if (!alerts || alerts.length === 0) {
      alertList.innerHTML = `<li class="no-alerts"><span class="icon"></span><div>Không có cảnh báo nào!</div></li>`;
      if (alertExpandContainer) alertExpandContainer.style.display = "none";
      return;
    }

    // Show only first 5 if not expanded
    const alertsToShow = isAlertsExpanded ? alerts : alerts.slice(0, 5);

    alertsToShow.forEach((alert) => {
      alertList.innerHTML += createAlertHTML(alert);
    });

    // Show/hide expand button
    if (alertExpandContainer) {
      if (alerts.length > 5) {
        alertExpandContainer.style.display = "block";
        alertExpandBtn.textContent = isAlertsExpanded ? "Thu gọn" : "Xem thêm";
      } else {
        alertExpandContainer.style.display = "none";
      }
    }
  }

  function createTimelineHTML(event) {
    let timeDisplay = event.time;
    try {
      const date = new Date(event.time);
      if (!isNaN(date.getTime())) {
        const timeStr = date.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        const dateStr = date.toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        });
        timeDisplay = `${timeStr}<br><span style="font-size: 0.85em; font-weight: normal; color: #64748b;">${dateStr}</span>`;
      }
    } catch (e) {
      console.error("Error formatting date:", e);
    }

    return `
            <li class="timeline-item">
                <div class="timeline-time" style="display: flex; flex-direction: column; justify-content: center; align-items: center; line-height: 1.2;">${timeDisplay}</div>
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
              <div class="user-info">${user?.name || "Unknown User"}</div>
              <div class="medicine-info">${
                medicine?.name || "Unknown Medicine"
              } ${medicine?.dosage ? `(${medicine.dosage})` : ""}</div>
              ${
                item.notes
                  ? `<div class="schedule-notes">${item.notes}</div>`
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
                <button class="btn-action btn-taken" data-id="${item.id}" data-action="taken">Đã uống</button>
                <button class="btn-action btn-missed" data-id="${item.id}" data-action="missed">Bỏ lỡ</button>
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
    timelineList.innerHTML = ""; // Clear existing list

    // Sắp xếp lịch theo buổi với custom time support
    schedules.sort((a, b) => {
      const periodA = getPeriodSortValue(a.period, a.customTime);
      const periodB = getPeriodSortValue(b.period, b.customTime);
      return periodA - periodB;
    });

    const todayString = getTodayString();
    let count = 0;

    schedules.forEach((item) => {
      if (item.date === todayString) {
        count++;
        // Lookup user and medicine details
        const user = localDataStore.users?.find((u) => u.id === item.userId);
        const medicine = localDataStore.medicines?.find(
          (m) => m.id === item.medicineId
        );

        const userName = user ? user.name : item.user || "Unknown User";
        const medicineName = medicine
          ? medicine.name
          : item.medicine || "Unknown Medicine";

        const displayPeriod = formatCustomPeriod(item.period, item.customTime);
        timelineList.innerHTML += `
                    <li class="timeline-item" data-status="pending" data-id="${item.id}" data-user="${userName}">
                        <div class="timeline-time">${displayPeriod}</div> <div class="timeline-content">
                            <div class="user">${userName}</div>
                            <div class="medication">${medicineName}</div>
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

    // Update count badge
    const timelineCount = document.getElementById("timeline-count");
    if (timelineCount) {
      timelineCount.textContent = count;
      timelineCount.style.display = count > 0 ? "inline-block" : "none";
    }

    if (count === 0) {
      timelineList.innerHTML =
        "<li class='no-timeline'><span class='icon'></span><div>Không có hoạt động nào hôm nay!</div></li>";
    }
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
                        <img src="${
                          user.avatar
                        }" alt="Avatar" class="user-avatar" onerror="this.src='https://i.pravatar.cc/150?img=${
        user.id % 70
      }'">
                        <div class="user-details">
                          <span class="user-name">${user.name}</span>
                          <small class="user-created">Tạo: ${formatDate(
                            user.createdAt
                          )}</small>
                        </div>
                    </div>
                    <button class="btn-delete" data-id="${
                      user.id
                    }" title="Xóa người dùng">Xóa</button>
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

    userSelectDropdown.innerHTML =
      "<option value=''>Chọn người dùng...</option>";

    if (!users || users.length === 0) {
      console.log("📝 No users found for dropdown");
      userSelectDropdown.innerHTML +=
        "<option disabled>Chưa có người dùng</option>";
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
          <button class="delete-inventory-btn" onclick="deleteMedicine(${
            medicine.id
          })" title="Xóa thuốc">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
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
              <span class="medicine-name">${medicine.name}</span>
              <span class="medicine-dosage">${medicine.dosage}</span>
              <button class="delete-medicine-btn" onclick="deleteMedicine(${
                medicine.id
              })" title="Xóa thuốc">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
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
                ? `<div class="medicine-instructions">${medicine.instructions}</div>`
                : ""
            }
            ${
              expiryWarning.message
                ? `<div class="warning-message">${expiryWarning.message}</div>`
                : ""
            }
            ${
              stockWarning
                ? `<div class="warning-message">Sắp hết thuốc!</div>`
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

  // Function to render user compliance stats dynamically
  function renderUserComplianceStats(users, complianceData) {
    const container = document.getElementById("stats-users-container");
    const avgElement = document.getElementById("stats-average");

    if (!container) return;

    container.innerHTML = "";

    if (!users || users.length === 0) {
      container.innerHTML =
        '<div class="no-data">Chưa có người dùng nào.</div>';
      if (avgElement) avgElement.textContent = "--";
      return;
    }

    let totalCompliance = 0;
    let count = 0;

    users.forEach((user) => {
      // Try to find compliance data for this user
      // Assuming complianceData keys are like "user1", "user2", etc. or just user IDs
      let percentage = 0;
      if (complianceData) {
        // Check for "user{id}" format
        if (complianceData[`user${user.id}`] !== undefined) {
          percentage = complianceData[`user${user.id}`];
        }
        // Check for direct ID format (if changed in backend)
        else if (complianceData[user.id] !== undefined) {
          percentage = complianceData[user.id];
        }
      }

      totalCompliance += percentage;
      count++;

      // Determine progress bar color class based on percentage
      let progressClass = "";
      if (percentage < 50) progressClass = "low";
      else if (percentage < 80) progressClass = "medium"; // You might need to add this class in CSS if not exists, or just rely on default/low

      const userStatHTML = `
        <div class="stats-user">
          <div class="stats-header">
            <span class="user-name">${user.name}</span>
            <span class="percentage">${percentage}%</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-bar-inner ${progressClass}"
              style="width: ${percentage}%"
            ></div>
          </div>
        </div>
      `;
      container.insertAdjacentHTML("beforeend", userStatHTML);
    });

    if (avgElement && count > 0) {
      const avg = Math.round(totalCompliance / count);
      avgElement.textContent = `${avg}%`;

      // Color code the average
      avgElement.className = "stats-avg"; // Reset
      if (avg < 50) avgElement.classList.add("low");
      else if (avg >= 80) avgElement.classList.add("high");
    }
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
        message: "Thuốc đã hết hạn!",
      };
    } else if (daysToExpiry <= 7) {
      return {
        class: "expiring-soon",
        message: `Sẽ hết hạn trong ${daysToExpiry} ngày`,
      };
    } else if (daysToExpiry <= 30) {
      return {
        class: "expiring-month",
        message: `Hết hạn trong ${daysToExpiry} ngày`,
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

    // Define colors for dynamic users
    const colors = [
      { base: "37, 99, 235", hex: "#2563eb" }, // Blue
      { base: "5, 150, 105", hex: "#059669" }, // Green
      { base: "220, 38, 38", hex: "#dc2626" }, // Red
      { base: "217, 119, 6", hex: "#d97706" }, // Amber
      { base: "147, 51, 234", hex: "#9333ea" }, // Purple
    ];

    // Generate datasets based on actual users
    const datasets = [];

    // Check if we have users in localDataStore
    if (
      localDataStore &&
      localDataStore.users &&
      localDataStore.users.length > 0
    ) {
      localDataStore.users.forEach((user, index) => {
        const color = colors[index % colors.length];

        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, `rgba(${color.base}, 0.8)`);
        gradient.addColorStop(1, `rgba(${color.base}, 0.2)`);

        const userKey = `user${user.id}`;
        // Get data for this user, default to zeros if not found
        const userData = stats.dailyBreakdown[userKey] || [0, 0, 0, 0, 0, 0, 0];

        datasets.push({
          label: user.name, // Use real user name
          data: userData,
          backgroundColor: gradient,
          borderColor: `rgba(${color.base}, 1)`,
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
        });
      });
    } else {
      // Fallback if no users found, try to use keys from stats
      const userKeys = Object.keys(stats.dailyBreakdown || {});
      userKeys.forEach((key, index) => {
        const color = colors[index % colors.length];
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, `rgba(${color.base}, 0.8)`);
        gradient.addColorStop(1, `rgba(${color.base}, 0.2)`);

        datasets.push({
          label: key, // Fallback to key
          data: stats.dailyBreakdown[key],
          backgroundColor: gradient,
          borderColor: `rgba(${color.base}, 1)`,
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
        });
      });
    }

    complianceChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: stats.labels,
        datasets: datasets,
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
              text: "Số liều đã uống",
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
              text: "Ngày trong tuần",
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

    renderAlertsList(data.alerts || []);

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
      renderUserComplianceStats(data.users || [], data.statistics.compliance);
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
    renderUserComplianceStats(
      data.users || [],
      data.statistics?.compliance || {}
    );

    // Update UI counters
    const userCount = document.getElementById("user-count");
    if (userCount) userCount.textContent = (data.users || []).length;

    const medicineCount = document.getElementById("medicine-count");
    if (medicineCount)
      medicineCount.textContent = (data.medicines || []).length;

    const alertCount = document.getElementById("alert-count");
    if (alertCount) {
      const unreadAlerts = (data.alerts || []).filter((alert) => !alert.isRead);
      alertCount.textContent = unreadAlerts.length;
    }

    console.log("✅ Initial data rendering completed!");
    showNotification("Hệ thống đã khởi động thành công!", "success", 3000);
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
      showNotification("Tủ thuốc mất kết nối!", "warning");
    } else if (data.status === "online") {
      showNotification("Tủ thuốc đã kết nối trở lại!", "success");
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
      showNotification("Cập nhật hoạt động mới!", "success");
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
            btn.innerHTML = "<span>Lưu thuốc</span>";
          else if (btn.innerHTML.includes("lịch"))
            btn.innerHTML = "<span>Lưu lịch</span>";
          else btn.innerHTML = "<span>Lưu người dùng</span>";
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

  socket.on("inventoryUpdated", (inventory) => {
    console.log("Cập nhật tồn kho:", inventory);
    localDataStore.inventory = inventory;
    renderInventoryDashboard(inventory, localDataStore.medicines);
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
        submitButton.innerHTML = "Đã lưu!";

        setTimeout(() => {
          submitButton.disabled = false;
          submitButton.innerHTML = "Lưu lịch hẹn";
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
    console.log("Nhận cập nhật thống kê:", data);
    localDataStore.statistics = data;

    renderUserComplianceStats(
      localDataStore.users || [],
      data.compliance || {}
    );

    const statsPage = document.getElementById("page-stats");
    if (statsPage && statsPage.style.display === "block") {
      renderStatisticsChart(data);
    }
  });

  // Timeline updates
  socket.on("timelineUpdated", (timeline) => {
    console.log("Cập nhật timeline:", timeline);
    localDataStore.timeline = timeline;

    // Update count badge
    const timelineCount = document.getElementById("timeline-count");
    if (timelineCount) {
      timelineCount.textContent = timeline.length;
      timelineCount.style.display =
        timeline.length > 0 ? "inline-block" : "none";
    }

    if (timelineList) {
      timelineList.innerHTML = "";
      if (timeline.length === 0) {
        timelineList.innerHTML =
          "<li class='no-timeline'><span class='icon'></span><div>Không có hoạt động nào hôm nay!</div></li>";
      } else {
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
    }
  });

  // Alerts updates
  socket.on("alertsUpdated", (alerts) => {
    console.log("Cập nhật cảnh báo:", alerts);
    localDataStore.alerts = alerts;

    renderAlertsList(alerts);

    const alertCount = document.getElementById("alert-count");
    if (alertCount)
      alertCount.textContent = alerts.filter((a) => !a.isRead).length;
  });

  // Enhanced reminder alerts with IoT status
  socket.on("reminderAlert", (reminderData) => {
    const iotStatus = reminderData.iotTriggered
      ? "IoT đã kích hoạt"
      : "IoT lỗi";
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

    // Update user count
    const userCount = document.getElementById("user-count");
    if (userCount) userCount.textContent = users.length;

    // Modern notification
    showNotification("Đã cập nhật danh sách người dùng!", "success");

    if (addUserForm) {
      const submitButton = addUserForm.querySelector(".btn-submit");
      if (submitButton) {
        // Success animation
        submitButton.style.background =
          "linear-gradient(135deg, #10b981 0%, #059669 100%)";
        submitButton.innerHTML = "Đã thêm!";

        setTimeout(() => {
          submitButton.disabled = false;
          submitButton.innerHTML = "Lưu người dùng";
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
          button.innerHTML = "Đang gửi IoT...";
          button.disabled = true;
          button.style.opacity = "0.7";

          // Add loading animation to timeline item
          item.style.transform = "scale(0.98)";
          item.style.transition = "transform 0.3s ease";

          socket.emit("sendReminder", { userId: item.dataset.id, user: user });

          setTimeout(() => {
            button.innerHTML = "Gửi nhắc nhở IoT";
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
          button.innerHTML = "Đang dừng...";
          button.disabled = true;
          button.style.opacity = "0.7";

          socket.emit("stopIoTAlert", { user: user });

          setTimeout(() => {
            button.innerHTML = "Dừng cảnh báo";
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
          button.innerHTML = "Đang test...";
          button.disabled = true;
          button.style.opacity = "0.7";

          socket.emit("testIoTConnection");

          setTimeout(() => {
            button.innerHTML = "Test IoT";
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
        submitButton.textContent = "Đang lưu...";
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
          submitButton.innerHTML = "<span>Lưu thuốc</span>";
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
        submitButton.textContent = "Đang lưu...";
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
        showNotification("Vui lòng nhập thời gian tùy chỉnh!", "error");
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = "<span>Lưu lịch uống thuốc</span>";
        }
        return;
      }

      // Check if medicines are selected
      if (selectedMedicines.length === 0) {
        showNotification("Vui lòng thêm ít nhất một loại thuốc!", "error");
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = "<span>Lưu lịch uống thuốc</span>";
        }
        return;
      }

      if (
        !scheduleData.userId ||
        selectedWeekdays.length === 0 ||
        !scheduleData.period ||
        !scheduleData.usageDuration
      ) {
        showNotification("Vui lòng điền đầy đủ thông tin!", "error");
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = "<span>Lưu lịch uống thuốc</span>";
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
        submitButton.textContent = "Đang lưu...";
      }

      const formData = new FormData(addUserForm);
      const userName = formData.get("userName");
      const avatarUrl = formData.get("avatarUrl");

      const data = {
        name: userName,
        avatars:
          uploadedAvatarPaths.length > 0
            ? uploadedAvatarPaths
            : avatarUrl
            ? [avatarUrl]
            : [],
      };

      if (!data.name || !data.name.trim()) {
        showNotification("Vui lòng nhập tên người dùng!", "error");
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = "<span>Lưu người dùng</span>";
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
