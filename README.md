# Tủ Thuốc AIoT - Smart Medicine Cabinet System

## Overview

This project is a comprehensive Smart Medicine Cabinet system designed to assist in medication management. It combines a web-based management interface with IoT capabilities to schedule reminders, track compliance, and ensure the right person takes the right medicine at the right time.

## System Architecture

### 1. Web Server (Node.js)

- **Framework**: Express.js
- **Real-time Communication**: Socket.io
- **Data Storage**: JSON-based local storage (`heThongData.json`)
- **Key Components**:
  - `server.js`: Main entry point, handles HTTP requests and Socket.io connections.
  - `models/dataManager.js`: Manages data persistence (CRUD operations for Users, Medicines, Schedules).
  - `utils/alertScheduler.js`: Handles cron-based scheduling for medication reminders.
  - `utils/eraIotClient.js`: Interface for communicating with the E-Ra IoT Platform.

### 2. Frontend (HTML/CSS/JS)

- **Location**: `public/`
- **Features**:
  - Dashboard for monitoring device status (Temp/Humidity).
  - User management with profile photos.
  - Medicine inventory management.
  - Schedule creation and management.
  - Statistical reports on compliance.

### 3. Image Processing Unit (Raspberry Pi) - _New_

- **Language**: Python
- **Functionality**:
  - Acts as a smart camera unit.
  - Receives triggers from the Web Server when it's time to take medicine.
  - Performs Face Recognition to verify the identity of the person taking medicine.
  - Syncs user profile photos from the Web Server/Drive.

## Data Flow & Logic

1.  **User Registration**:

    - Admin registers a user on the Web Interface.
    - Uploads 4-5 profile photos for better recognition accuracy.
    - Data is saved to `heThongData.json` and photos are stored in `public/assets/downloads/profile`.

2.  **Scheduling**:

    - Admin sets a medication schedule (e.g., 8:00 AM).
    - `AlertScheduler` registers a cron job.

3.  **Alert & Check-in Process**:
    - **Time Reached**: `AlertScheduler` triggers.
    - **Notification**: System sends a signal to E-Ra IoT (to turn on lights/buzzer) and notifies the Web Dashboard.
    - **Camera Trigger**: System calls the Raspberry Pi to start the "Check-in" mode.
    - **Monitoring**: The Pi monitors the camera for 30-60 minutes.
    - **Verification**:
      - Pi detects a face.
      - Compares with downloaded user profiles.
      - If match found: Logs "Taken" event, notifies Server.
      - If no match/timeout: Logs "Missed" event.

## Setup & Installation

### Web Server

1.  Install dependencies: `npm install`
2.  Run server: `npm run dev` or `node server.js`
3.  Access at: `http://localhost:3000`

### Raspberry Pi (Image Processing)

1.  Navigate to `image_processing/`
2.  Install Python dependencies: `pip install -r requirements.txt`
3.  Configure `.env` file (copy from `.env.example`).
4.  Run the agent: `python main.py`

## Conventions

- **Code Style**: Standard JavaScript/Node.js conventions.
- **Data**: JSON files are used for simplicity and portability.
- **Communication**: REST API for static data, Socket.io for real-time updates.
