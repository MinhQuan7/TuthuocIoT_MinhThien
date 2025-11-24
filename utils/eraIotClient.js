// E-Ra IoT Platform Client for Medication Reminder
// Author: Tech Lead
// Version: 1.0.0

const https = require("https");

class EraIotClient {
  constructor() {
    // E-Ra IoT Platform Configuration
    this.authToken = "Token 78072b06a81e166b8b900d95f4c2ba1234272955";
    this.baseUrl = "https://backend.eoh.io";
    this.configId = "148698";
    this.actionOnKey = "cbfe9e98-669a-4fbf-a8d2-45c59c4aef4e";
    this.actionOffKey = "7c1ea8e2-3f7a-4db2-adcc-eeeed0576e36";
    this.initialized = true;
  }

  /**
   * Make HTTP request to E-Ra IoT Platform
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request payload
   * @returns {Promise<Object>} Response data
   */
  makeRequest(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.baseUrl);

      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: method,
        headers: {
          Authorization: this.authToken,
          "Content-Type": "application/json",
        },
      };

      if (data && method !== "GET") {
        const postData = JSON.stringify(data);
        options.headers["Content-Length"] = Buffer.byteLength(postData);
      }

      const req = https.request(options, (res) => {
        let body = "";

        res.on("data", (chunk) => {
          body += chunk;
        });

        res.on("end", () => {
          try {
            let response = {};

            // Check if response is JSON or HTML/Text
            if (body && body.trim()) {
              const trimmedBody = body.trim();

              // More robust JSON detection
              if (
                (trimmedBody.startsWith("{") && trimmedBody.endsWith("}")) ||
                (trimmedBody.startsWith("[") && trimmedBody.endsWith("]"))
              ) {
                try {
                  response = JSON.parse(body);
                } catch (parseError) {
                  console.warn(
                    `[E-Ra IoT] JSON parse failed, treating as text response`
                  );
                  response = {
                    error: "Invalid JSON response",
                    message: trimmedBody.substring(0, 200),
                    raw: true,
                  };
                }
              } else if (
                trimmedBody.toLowerCase().includes("<!doctype") ||
                trimmedBody.toLowerCase().includes("<html")
              ) {
                // Handle HTML error pages (404, 500, etc.)
                console.warn(
                  `[E-Ra IoT] HTML error page received (Status: ${res.statusCode})`
                );
                response = {
                  error: "HTML error page received",
                  message: `Server returned HTML page instead of JSON (Status: ${res.statusCode})`,
                  statusCode: res.statusCode,
                  raw: true,
                };
              } else {
                // Handle other text responses
                response = {
                  message: trimmedBody.substring(0, 200),
                  raw: true,
                };
              }
            } else {
              // Empty response
              response = {
                message: "Empty response from server",
                raw: true,
              };
            }

            console.log(
              `[E-Ra IoT] ${method} ${endpoint} - Status: ${res.statusCode}${
                response.error ? ` - Error: ${response.error}` : ""
              }`
            );

            resolve({
              statusCode: res.statusCode,
              data: response,
              success:
                res.statusCode >= 200 &&
                res.statusCode < 300 &&
                !response.error,
            });
          } catch (error) {
            console.error(`[E-Ra IoT] Parse error:`, error.message);
            console.error(
              `[E-Ra IoT] Response preview:`,
              body?.substring(0, 100) + "..."
            );

            // Return error response instead of rejecting
            resolve({
              statusCode: res.statusCode || 500,
              data: {
                error: `Parse error: ${error.message}`,
                body: body?.substring(0, 200),
                parseError: true,
              },
              success: false,
            });
          }
        });
      });

      req.on("error", (error) => {
        console.error(`[E-Ra IoT] Request error:`, error);
        reject(error);
      });

      // Write data to request body if provided
      if (data && method !== "GET") {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  /**
   * Trigger action on ESP32 device
   * @param {string} actionKey - Action key (ON or OFF)
   * @returns {Promise<boolean>} Success status
   */
  async triggerAction(actionKey) {
    if (!this.initialized) {
      console.error("[E-Ra IoT] Client not initialized");
      return false;
    }

    try {
      const endpoint = "/api/chip_manager/trigger_action/";

      // Determine value based on action key (ON=1, OFF=0)
      const value = actionKey === this.actionOnKey ? 1 : 0;

      // Create JSON payload according to E-Ra API format
      const payload = {
        key: actionKey,
        source: "internet",
      };

      console.log(
        `[E-Ra IoT] Triggering action: ${actionKey} with value: ${value}`
      );

      const response = await this.makeRequest("POST", endpoint, payload);

      if (response.success) {
        console.log(
          `[E-Ra IoT] Successfully triggered action: ${actionKey} with value: ${value}`
        );
        return true;
      } else {
        console.error(
          `[E-Ra IoT] Failed to trigger action: ${actionKey}, Status: ${response.statusCode}`
        );
        return false;
      }
    } catch (error) {
      console.error(`[E-Ra IoT] Error triggering action:`, error);
      return false;
    }
  }

  /**
   * Turn ON LED and buzzer (medication reminder alert)
   * @returns {Promise<boolean>} Success status
   */
  async turnOnAlert() {
    console.log("[E-Ra IoT] Turning ON medication alert (LED + Buzzer)");
    return await this.triggerAction(this.actionOnKey);
  }

  /**
   * Turn OFF LED and buzzer (stop alert)
   * @returns {Promise<boolean>} Success status
   */
  async turnOffAlert() {
    console.log("[E-Ra IoT] Turning OFF medication alert (LED + Buzzer)");
    return await this.triggerAction(this.actionOffKey);
  }

  /**
   * Send medication reminder with auto-off after duration
   * @param {number} duration - Alert duration in milliseconds (default 30 seconds)
   * @returns {Promise<boolean>} Success status
   */
  async sendMedicationReminder(duration = 30000) {
    try {
      console.log(`[E-Ra IoT] Sending medication reminder for ${duration}ms`);

      // Turn on alert
      const onResult = await this.turnOnAlert();

      if (!onResult) {
        console.error("[E-Ra IoT] Failed to turn on alert");
        return false;
      }

      // Auto turn off after duration
      setTimeout(async () => {
        try {
          await this.turnOffAlert();
          console.log("[E-Ra IoT] Auto turned off alert after duration");
        } catch (error) {
          console.error("[E-Ra IoT] Error auto turning off alert:", error);
        }
      }, duration);

      return true;
    } catch (error) {
      console.error("[E-Ra IoT] Error sending medication reminder:", error);
      return false;
    }
  }

  /**
   * Test connection to E-Ra IoT Platform
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection() {
    try {
      console.log("[E-Ra IoT] Testing connection to E-Ra Platform...");

      // Test with a simple endpoint that should work
      const response = await this.makeRequest("GET", "/");

      // Check for successful connection (even if endpoint returns error)
      if (response.statusCode >= 200 && response.statusCode < 500) {
        console.log(
          `[E-Ra IoT] Connection test successful - Server reachable (Status: ${response.statusCode})`
        );
        return true;
      } else if (response.statusCode >= 500) {
        console.warn(
          `[E-Ra IoT] Server error but connection established - Status: ${response.statusCode}`
        );
        return true; // Server is reachable even with 5xx errors
      }

      console.error(
        `[E-Ra IoT] Connection test failed - Status: ${response.statusCode}`
      );
      return false;
    } catch (error) {
      console.error("[E-Ra IoT] Connection test error:", error.message);

      // Check if it's a network error vs API error
      if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
        console.error(
          "[E-Ra IoT] Network connection failed - Check internet connection and server URL"
        );
      } else if (error.code === "ETIMEDOUT") {
        console.error(
          "[E-Ra IoT] Connection timeout - Server may be overloaded"
        );
      }

      return false;
    }
  }

  /**
   * Get client configuration info
   * @returns {Object} Configuration details
   */
  getConfig() {
    return {
      baseUrl: this.baseUrl,
      configId: this.configId,
      actionOnKey: this.actionOnKey,
      actionOffKey: this.actionOffKey,
      initialized: this.initialized,
    };
  }
}

module.exports = EraIotClient;
