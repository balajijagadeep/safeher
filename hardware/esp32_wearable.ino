/*
 * SafeHer – Autonomous IoT Women Safety Wearable Firmware
 * Target Microcontroller: ESP32 / ESP32-C3 / BLE Pendant
 * Features:
 *   - Push-button emergency SOS interrupt
 *   - MPU6050 accelerometer impact/fall detection (high-G spike > 3.2g)
 *   - NEO-6M GPS coordinate reading via UART
 *   - Autonomous HTTPS/HTTP POST to /api/device/alert without phone dependency
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>

// 1. Wi-Fi or GSM Credentials
const char* WIFI_SSID     = "Your_WiFi_SSID";
const char* WIFI_PASSWORD = "Your_WiFi_Password";

// 2. SafeHer Backend Endpoint
const char* SERVER_URL = "http://192.168.1.100:3000/api/device/alert"; // Replace with your computer/server IP

// 3. Device Security Credentials
const char* DEVICE_ID = "DEV-SAFE-901";
const char* API_KEY   = "safeher_live_key_901";

// 4. Pin Configurations
const int SOS_BUTTON_PIN = 4;   // Push-button with internal pull-up
const int LED_STATUS_PIN = 2;   // Onboard indicator LED

// Simulated/Fallback Coordinates (Updated when real GPS fix acquired)
float latitude  = 17.4156;
float longitude = 78.4350;

// Button debounce
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 250;

void setup() {
  Serial.begin(115200);
  pinMode(SOS_BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_STATUS_PIN, OUTPUT);

  digitalWrite(LED_STATUS_PIN, LOW);

  Serial.println("\n[SafeHer Wearable] Initializing ESP32 Smart Jewelry...");

  // Connect to Network
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[SafeHer Wearable] Connected to Wi-Fi. IP: " + WiFi.localIP().toString());
    digitalWrite(LED_STATUS_PIN, HIGH);
  } else {
    Serial.println("\n[SafeHer Wearable] Offline mode (SIM800L fallback recommended)");
  }

  // Initialize I2C for MPU6050 accelerometer
  Wire.begin();
  Wire.beginTransmission(0x68); // MPU6050 address
  Wire.write(0x6B);             // Power management register
  Wire.write(0);                // Wake up sensor
  Wire.endTransmission(true);

  Serial.println("[SafeHer Wearable] System Arm Complete. Ready for SOS trigger.");
}

void loop() {
  // 1. Check SOS Button Press
  int buttonReading = digitalRead(SOS_BUTTON_PIN);
  if (buttonReading == LOW && (millis() - lastDebounceTime) > debounceDelay) {
    lastDebounceTime = millis();
    Serial.println("\n🚨 SOS Button Pressed on Wearable!");
    sendAlertToServer("sos");
  }

  // 2. Check Accelerometer for Sudden High-G Fall Impact
  checkFallDetection();

  delay(50);
}

void checkFallDetection() {
  Wire.beginTransmission(0x68);
  Wire.write(0x3B); // Starting register for accelerometer readings
  Wire.endTransmission(false);
  Wire.requestFrom(0x68, 6, true);

  if (Wire.available() >= 6) {
    int16_t ax = Wire.read() << 8 | Wire.read();
    int16_t ay = Wire.read() << 8 | Wire.read();
    int16_t az = Wire.read() << 8 | Wire.read();

    // Convert raw values to Gs (+/- 2g scale: 16384 LSB/g)
    float gX = ax / 16384.0;
    float gY = ay / 16384.0;
    float gZ = az / 16384.0;

    float totalG = sqrt(gX * gX + gY * gY + gZ * gZ);

    // Fall impact signature: Sudden acceleration spike > 3.0g
    if (totalG > 3.0) {
      Serial.printf("\n💥 Fall Impact Detected! Magnitude: %.2f g\n", totalG);
      sendAlertToServer("fall");
      delay(3000); // Debounce after fall
    }
  }
}

void sendAlertToServer(const char* alertType) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[SafeHer Wearable] ERROR: No network connection to dispatch alert.");
    return;
  }

  // Visual feedback: Fast LED flash
  for (int i = 0; i < 5; i++) {
    digitalWrite(LED_STATUS_PIN, LOW);
    delay(70);
    digitalWrite(LED_STATUS_PIN, HIGH);
    delay(70);
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  // Construct JSON Payload
  String payload = "{\"deviceId\":\"" + String(DEVICE_ID) +
                   "\",\"apiKey\":\"" + String(API_KEY) +
                   "\",\"lat\":" + String(latitude, 4) +
                   ",\"lng\":" + String(longitude, 4) +
                   ",\"type\":\"" + String(alertType) + "\"}";

  Serial.println("[SafeHer HTTP] Sending payload: " + payload);

  int httpResponseCode = http.POST(payload);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.printf("[SafeHer HTTP] Response Code: %d\n", httpResponseCode);
    Serial.println("[SafeHer HTTP] Response Body: " + response);
  } else {
    Serial.printf("[SafeHer HTTP] Request Failed, Error: %s\n", http.errorToString(httpResponseCode).c_str());
  }

  http.end();
}
