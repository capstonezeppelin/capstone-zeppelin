#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include <SPI.h>
#include <LoRa.h>
#include "secrets.h"


// LoRa configuration (adjust pins and frequency based on your hardware)
#define LORA_SS 18
#define LORA_RST 14
#define LORA_DIO0 26
#define LORA_FREQUENCY 433E6  // Adjust to your region's frequency (e.g., 915E6 for US)

// // Wi-Fi credentials (in the secrets.h file)
// const char* ssid = ;     // Default Wokwi WiFi
// const char* password = ;             // No password for Wokwi-GUEST

// // Firebase configuration (in the secrets.h file)
// const char* FIREBASE_DATABASE_URL = ;
// const char* FIREBASE_API_KEY = ;

// Number of LoRa senders
const int NUM_SENDERS = 3;  // Adjust based on the number of LoRa senders

// Timer variables
unsigned long startTime = 0;
unsigned long lastReadingTime = 0;
unsigned long lastFirebaseUpdate = 0;
bool systemStarted = false;

// Intervals
const unsigned long POLL_INTERVAL = 2000;   // Poll each sender every 2 seconds (cycle time: NUM_SENDERS * 2s)
const unsigned long FIREBASE_UPDATE_INTERVAL = 5000; // Update Firebase session data every 5 seconds
const unsigned long POLL_TIMEOUT = 1000;    // Timeout waiting for sender response (1 second)

// Variables to store sensor data for each sender
struct SensorData {
  float temperature = 0.0;
  float humidity = 0.0;
  float heatIndex = 0.0;
  bool error = false;
  unsigned long lastUpdate = 0;
};

SensorData senders[NUM_SENDERS];
int readingCount = 0;

// Current sender being polled (0 to NUM_SENDERS-1)
int currentPoll = 0;

// Create a web server on port 80
WebServer server(80);

void setup() {
  // Initialize Serial Monitor
  Serial.begin(115200);
  while (!Serial) delay(10);
  Serial.println("ESP32 LoRa Receiver Gateway with Firebase Integration");
  Serial.println("Compatible with Wokwi Simulator (Note: LoRa simulation may require custom setup in Wokwi)");
  Serial.println("Type 'STOP' in Serial Monitor to end the session and log final data.");

  // Initialize LoRa
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(LORA_FREQUENCY)) {
    Serial.println("LoRa initialization failed!");
    while (true) delay(1000);
  }
  LoRa.setSyncWord(0xF3);  // Sync word to match senders (adjust as needed)
  LoRa.setSpreadingFactor(7);  // Adjust for range vs. speed
  Serial.println("LoRa initialized");

  // Connect to Wi-Fi
  Serial.print("Connecting to ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  
  int wifiRetryCount = 0;
  const int maxWifiRetries = 20;
  while (WiFi.status() != WL_CONNECTED && wifiRetryCount < maxWifiRetries) {
    delay(500);
    Serial.print(".");
    wifiRetryCount++;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi connection failed. Check credentials or signal.");
    while (true) delay(1000);
  }

  Serial.println("");
  Serial.println("WiFi connected.");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  // Configure NTP for Unix timestamp
  configTime(0, 0, "pool.ntp.org");
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
  } else {
    Serial.println("Time obtained from NTP");
  }

  // Start web server
  server.on("/", handleRoot);
  server.on("/data", handleData);
  server.begin();
  Serial.println("Web server started. Visit http://" + WiFi.localIP().toString());

  // Initialize system
  startTime = millis();
  systemStarted = true;
  Serial.println("System initialized. Starting LoRa polling...");
  Serial.println("Firebase integration ready!");
}

// Handle root URL request
void handleRoot() {
  String html = "<!DOCTYPE html><html>";
  html += "<head><title>ESP32 LoRa Sensor Monitor</title>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<meta http-equiv='refresh' content='5'>";
  html += "<style>body { font-family: Arial, sans-serif; text-align: center; margin: 20px; }";
  html += "h1 { color: #333; } .data { font-size: 1.4em; margin: 15px; padding: 15px; }";
  html += ".sensor-card { border: 2px solid #4CAF50; padding: 20px; margin: 10px; border-radius: 10px; background-color: #f9f9f9; }";
  html += ".firebase-status { background-color: #e8f5e8; padding: 10px; margin: 10px; border-radius: 5px; }";
  html += ".error { color: red; background-color: #ffe6e6; }";
  html += ".success { color: green; }</style>";
  html += "</head><body>";
  html += "<h1>🌡️ ESP32 LoRa Sensor Monitor</h1>";
  html += "<div class='firebase-status'><b>Firebase:</b> Data is being stored to Firebase Realtime Database</div>";
  
  for (int i = 0; i < NUM_SENDERS; i++) {
    int senderId = i + 1;
    html += "<div class='sensor-card'>";
    html += "<h2>Sender " + String(senderId) + "</h2>";
    if (senders[i].error || senders[i].lastUpdate == 0) {
      html += "<p class='error'>❌ No data or error</p>";
    } else {
      html += "<p class='data success'><b>Temperature:</b> " + String(senders[i].temperature, 1) + " °C</p>";
      html += "<p class='data success'><b>Humidity:</b> " + String(senders[i].humidity, 1) + " %</p>";
      html += "<p class='data success'><b>Heat Index:</b> " + String(senders[i].heatIndex, 1) + " °C</p>";
      html += "<p class='data'><b>Last Update:</b> " + String((millis() - senders[i].lastUpdate) / 1000.0, 2) + " seconds ago</p>";
    }
    html += "</div>";
  }
  html += "<div class='data'><b>Total Reading Count:</b> " + String(readingCount) + "</div>";
  html += "<div class='data'><b>Elapsed Time:</b> " + String((millis() - startTime) / 1000.0, 2) + " seconds</div>";
  html += "</body></html>";
  server.send(200, "text/html", html);
}

// Handle data endpoint for AJAX requests
void handleData() {
  StaticJsonDocument<512> doc;  // Increased size for multiple senders
  JsonArray senderArray = doc.createNestedArray("senders");
  for (int i = 0; i < NUM_SENDERS; i++) {
    JsonObject senderObj = senderArray.createNestedObject();
    senderObj["id"] = i + 1;
    senderObj["temperature"] = String(senders[i].temperature, 1);
    senderObj["humidity"] = String(senders[i].humidity, 1);
    senderObj["heat_index"] = String(senders[i].heatIndex, 1);
    senderObj["error"] = senders[i].error;
    senderObj["last_update"] = (millis() - senders[i].lastUpdate) / 1000.0;
  }
  doc["reading_count"] = readingCount;
  doc["elapsed_time"] = (millis() - startTime) / 1000.0;

  String jsonString;
  serializeJson(doc, jsonString);
  server.send(200, "application/json", jsonString);
}

// Function to send sensor data to Firebase
void sendToFirebase(float temp, float hum, float hi, int count, float elapsedTime, int senderId) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    
    String firebaseURL = String(FIREBASE_DATABASE_URL) + "/sensor_data/sender" + String(senderId) + "/" + String(millis()) + ".json?auth=" + String(FIREBASE_API_KEY);
    
    http.begin(firebaseURL);
    http.addHeader("Content-Type", "application/json");
    
    StaticJsonDocument<200> doc;
    doc["timestamp"] = millis();
    doc["temperature"] = String(temp, 1);
    doc["humidity"] = String(hum, 1);
    doc["heat_index"] = String(hi, 1);
    doc["reading_count"] = count;
    doc["elapsed_time"] = elapsedTime;
    doc["unix_timestamp"] = time(NULL);
    doc["sender_id"] = senderId;
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    int httpResponseCode = http.PUT(jsonString);
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Firebase Response Code: " + String(httpResponseCode));
      if (httpResponseCode == 200) {
        Serial.println("Data successfully sent to Firebase for sender " + String(senderId));
      } else {
        Serial.println("Firebase Error: " + response);
      }
    } else {
      Serial.println("Firebase connection failed. Error code: " + String(httpResponseCode));
    }
    
    http.end();
  } else {
    Serial.println("WiFi not connected. Cannot send to Firebase.");
  }
}

// Function to send session data to Firebase for a specific sender
void sendSessionDataToFirebase(int senderId) {
  if (WiFi.status() == WL_CONNECTED && senders[senderId - 1].lastUpdate > 0) {
    HTTPClient http;
    
    String firebaseURL = String(FIREBASE_DATABASE_URL) + "/session_data/sender" + String(senderId) + "/" + String(millis()) + ".json?auth=" + String(FIREBASE_API_KEY);
    
    http.begin(firebaseURL);
    http.addHeader("Content-Type", "application/json");
    
    StaticJsonDocument<300> doc;
    doc["session_start"] = startTime;
    doc["session_end"] = lastReadingTime;
    doc["total_duration"] = (lastReadingTime - startTime) / 1000.0;
    doc["last_temperature"] = String(senders[senderId - 1].temperature, 1);
    doc["last_humidity"] = String(senders[senderId - 1].humidity, 1);
    doc["last_heat_index"] = String(senders[senderId - 1].heatIndex, 1);
    doc["reading_count"] = readingCount;
    doc["session_timestamp"] = time(NULL);
    doc["sender_id"] = senderId;
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    int httpResponseCode = http.PUT(jsonString);
    
    if (httpResponseCode > 0) {
      Serial.println("Session data sent to Firebase for sender " + String(senderId) + ". Response Code: " + String(httpResponseCode));
    } else {
      Serial.println("Failed to send session data to Firebase for sender " + String(senderId) + ". Error code: " + String(httpResponseCode));
    }
    
    http.end();
  }
}

void loop() {
  // Handle web server requests
  server.handleClient();

  // Check for Serial input to stop the session
  if (Serial.available()) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    if (input.equalsIgnoreCase("STOP") && systemStarted) {
      unsigned long totalTime = lastReadingTime - startTime;
      Serial.print("Session stopped. Total session time: ");
      Serial.print(totalTime / 1000.0);
      Serial.println(" seconds");
      
      // Send session data for all senders
      for (int i = 1; i <= NUM_SENDERS; i++) {
        sendSessionDataToFirebase(i);
      }
      
      systemStarted = false;
      for (int i = 0; i < NUM_SENDERS; i++) {
        senders[i].temperature = 0.0;
        senders[i].humidity = 0.0;
        senders[i].heatIndex = 0.0;
      }
      return;
    }
  }

  // Poll LoRa senders in turn every POLL_INTERVAL
  static unsigned long lastPollTime = 0;
  if (millis() - lastPollTime > POLL_INTERVAL && systemStarted) {
    int senderId = currentPoll + 1;

    // Send poll request
    LoRa.beginPacket();
    LoRa.print("POLL");
    LoRa.print(senderId);
    LoRa.endPacket();
    Serial.print("Polling sender ");
    Serial.println(senderId);

    // Wait for response with timeout
    unsigned long waitStart = millis();
    bool received = false;
    while (millis() - waitStart < POLL_TIMEOUT) {
      int packetSize = LoRa.parsePacket();
      if (packetSize) {
        String incoming = "";
        while (LoRa.available()) {
          incoming += (char)LoRa.read();
        }

        // Expected format: DATA<ID>:temp,hum,hi
        String expectedPrefix = "DATA" + String(senderId) + ":";
        if (incoming.startsWith(expectedPrefix)) {
          String dataStr = incoming.substring(expectedPrefix.length());
          float temp, hum, hi;
          int parsed = sscanf(dataStr.c_str(), "%f,%f,%f", &temp, &hum, &hi);
          if (parsed == 3) {
            senders[currentPoll].temperature = temp;
            senders[currentPoll].humidity = hum;
            senders[currentPoll].heatIndex = hi;
            senders[currentPoll].lastUpdate = millis();
            senders[currentPoll].error = false;

            lastReadingTime = millis();
            float elapsedTime = (lastReadingTime - startTime) / 1000.0;

            Serial.print("Received from sender ");
            Serial.print(senderId);
            Serial.print(": Temperature: ");
            Serial.print(temp, 1);
            Serial.print(" °C | Humidity: ");
            Serial.print(hum, 1);
            Serial.print(" % | Heat Index: ");
            Serial.print(hi, 1);
            Serial.print(" °C | Reading Count: ");
            Serial.print(readingCount);
            Serial.print(" | Elapsed Time: ");
            Serial.print(elapsedTime, 2);
            Serial.println(" seconds");

            // Send to Firebase
            sendToFirebase(temp, hum, hi, readingCount, elapsedTime, senderId);
            readingCount++;

            received = true;
          } else {
            Serial.println("Invalid data format from sender " + String(senderId));
            senders[currentPoll].error = true;
          }
          break;
        }
      }
    }

    if (!received) {
      Serial.print("No response from sender ");
      Serial.println(senderId);
      senders[currentPoll].error = true;
    }

    // Move to next sender
    currentPoll = (currentPoll + 1) % NUM_SENDERS;
    lastPollTime = millis();
  }

  // Periodic Firebase update for session data (every 5 seconds)
  if (systemStarted && (millis() - lastFirebaseUpdate > FIREBASE_UPDATE_INTERVAL)) {
    for (int i = 1; i <= NUM_SENDERS; i++) {
      sendSessionDataToFirebase(i);
    }
    lastFirebaseUpdate = millis();
  }

  // Small delay to prevent tight looping
  delay(10);
}