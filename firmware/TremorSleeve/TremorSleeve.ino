#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>
#include <esp_dsp.h>

//Stuff for BLE

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>


// BLE UUIDs - MUST match the app
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// BLE objects
BLEServer *pServer = NULL;
BLECharacteristic *pTremorCharacteristic = NULL;
bool deviceConnected = false;

struct TremorPacket {
  float maxAmplitude;      // peak band-limited tremor amplitude in m/s^2 - 4 bytes
  bool tremor;             // tremor detected during window - 1 byte
} __attribute__((packed));


#define SAMPLE_RATE 200
#define WINDOW_SIZE 256
#define FFT_INTERVAL 100   // 0.5 sec

#define ratioThreshold 1
#define powerThreshold 1


#define N 256

#define MPU1_INT_PIN 5

// Send a packet every TOTAL_WINDOW_SECONDS. The FFT loop runs every
// 0.5 seconds (FFT_INTERVAL=100 samples at 200Hz), so the counter
// must hit TOTAL_WINDOW_SECONDS*2 to span that many seconds.
#define TOTAL_WINDOW_SECONDS  30

#define COUNTER_THRESHOLD ((TOTAL_WINDOW_SECONDS * 2))



float circularBufferX[WINDOW_SIZE];
float circularBufferY[WINDOW_SIZE];
float circularBufferZ[WINDOW_SIZE];
float maxX = 0;
float maxY = 0;
float maxZ = 0;

float fftBufferX[2 * WINDOW_SIZE];   // interleaved real/imag
float fftBufferY[2 * WINDOW_SIZE];   // interleaved real/imag
float fftBufferZ[2 * WINDOW_SIZE];   // interleaved real/imag

float window[WINDOW_SIZE];

// We track booleans/amplitudes for 20 sub-windows (covers 10 seconds at
// 0.5s/window). Sized larger than strictly needed for safety.
bool tremor10second[10*2];
float tremor10secondAmplitude[10*2];
int tremor60counter = 0;
bool tremorHappened = false;
float maxAmplitude = 0;



int tremor10idx = 0;

float powerN = 0;
float powerT = 0;

int writeIndex = 0;
int samplesSinceFFT = 0;
bool bufferFull = false;

int lowerTremor = 5; //3.9 hz
int higherTremor = 32; //25 hz
int lowerNormal = 0; //0 hz
int higherNormal = 4; //3.1 hz




Adafruit_MPU6050 mpu1;

volatile bool mpu1Interrupt = false;

volatile uint32_t mpu1Timestamp = 0;




void FFTsetup() {

  // Initialize ESP-DSP
  dsps_fft2r_init_fc32(NULL, CONFIG_DSP_MAX_FFT_SIZE);

  // Create Hanning window
  dsps_wind_hann_f32( window, WINDOW_SIZE );
}

void addSample(float ax, float ay, float az) {

  circularBufferX[writeIndex] = ax;
  circularBufferY[writeIndex] = ay;
  circularBufferZ[writeIndex] = az;


  writeIndex = (writeIndex + 1) % N;

  if (writeIndex == 0)
    bufferFull = true;

  samplesSinceFFT++;
}

void runFFT() {

  int index = writeIndex;



  float meanX = 0;
  float meanY = 0;
  float meanZ = 0;


  for (int i = 0; i < N; i++) {
      meanX += circularBufferX[i];
      meanY += circularBufferY[i];
      meanZ += circularBufferZ[i];

  }
  meanX /= N;
  meanY /= N;
  meanZ /= N;

  // Copy circular buffer in time order + apply window
  for (int i = 0; i < N; i++) {

    fftBufferX[2*i] = (circularBufferX[index] - meanX) * window[i];  // Real
    fftBufferX[2*i + 1] = 0;                      // Imag
    fftBufferY[2*i] = (circularBufferY[index] - meanY) * window[i];  // Real
    fftBufferY[2*i + 1] = 0;                      // Imag
    fftBufferZ[2*i] = (circularBufferZ[index] - meanZ) * window[i];  // Real
    fftBufferZ[2*i + 1] = 0;                      // Imag

    index = (index + 1) % N;
  }

  // Perform FFT
  dsps_fft2r_fc32(fftBufferX, N);
  dsps_bit_rev_fc32(fftBufferX, N);
  dsps_cplx2reC_fc32(fftBufferX, N);

  dsps_fft2r_fc32(fftBufferY, N);
  dsps_bit_rev_fc32(fftBufferY, N);
  dsps_cplx2reC_fc32(fftBufferY, N);

  dsps_fft2r_fc32(fftBufferZ, N);
  dsps_bit_rev_fc32(fftBufferZ, N);
  dsps_cplx2reC_fc32(fftBufferZ, N);

  calculateBandPower();
}

void calculateBandPower() {

  powerN = 0;
  powerT = 0;

  for (int i = lowerNormal; i <= higherNormal; i++) {  
    float realX = fftBufferX[2*i];
    float imagX = fftBufferX[2*i + 1];

    float realY = fftBufferY[2*i];
    float imagY = fftBufferY[2*i + 1];

    float realZ = fftBufferZ[2*i];
    float imagZ = fftBufferZ[2*i + 1];

    float magSq = realX*realX + imagX*imagX + realY*realY + imagY*imagY + realZ*realZ + imagZ*imagZ;

    powerN += magSq;
  }

  for (int i = lowerTremor; i <= higherTremor; i++) { 
    float realX = fftBufferX[2*i];
    float imagX = fftBufferX[2*i + 1];

    float realY = fftBufferY[2*i];
    float imagY = fftBufferY[2*i + 1];

    float realZ = fftBufferZ[2*i];
    float imagZ = fftBufferZ[2*i + 1];

    float magSq = realX*realX + imagX*imagX + realY*realY + imagY*imagY + realZ*realZ + imagZ*imagZ;

    powerT += magSq;
  }

}




void IRAM_ATTR onDataReady1() { mpu1Interrupt = true;
      //mpu1Timestamp = micros();  // exact time sample is ready

 }







void writeRegister(uint8_t addr, uint8_t reg, uint8_t data) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  Wire.write(data);
  Wire.endTransmission();
}

class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println("Device connected");
  };

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    Serial.println("Device disconnected");
    // Restart advertising
    pServer->startAdvertising();
    Serial.println("Advertising restarted");
  }
};


void setupBLE() {
  Serial.println("Initializing BLE...");
  
  // Create the BLE Device
  BLEDevice::init("TremorSleeve");
  
  // Create the BLE Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  
  // Create the BLE Service
  BLEService *pService = pServer->createService(SERVICE_UUID);
  
  // Create a BLE Characteristic for tremor data
  pTremorCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_NOTIFY
  );
  
  // Add BLE2902 descriptor for notifications
  pTremorCharacteristic->addDescriptor(new BLE2902());
  
  // Start the service
  pService->start();
  
  // Start advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  
  Serial.println("BLE device is now advertising as 'TremorSleeve'");
}

void sendTremorPacket() {
  if (!deviceConnected) {
    Serial.println("No device connected - skipping packet send");
    return;
  }
  

  TremorPacket packet;
  packet.maxAmplitude = maxAmplitude;
  packet.tremor = tremorHappened;
  
  Serial.print("Sending packet: amp=");
  Serial.print(maxAmplitude, 3);
  Serial.print(" tremor=");
  Serial.println(tremorHappened ? "true" : "false");

  // Send via BLE
  pTremorCharacteristic->setValue((uint8_t*)&packet, sizeof(packet));
  pTremorCharacteristic->notify();
}

// BLE Server Callbacks


void setup() {
  // put your setup code here, to run once:
  Serial.begin(230400);
  delay(5000);

//  while (!Serial)
//    delay(10); // will pause Zero, Leonardo, etc until serial console opens
  

  setupBLE();


  // Try to initialize!
  if (!mpu1.begin()) {
    Serial.println("Failed to find MPU6050 chip");
    while (1) {
      delay(10);
    }
  }
  Serial.println("MPU6050 #1 Found!");

  Wire.begin();


  mpu1.setSampleRateDivisor(4);

  // Enable interrupt in MPU
  writeRegister(0x68, 0x38, 0x01);

  pinMode(MPU1_INT_PIN, INPUT);
  attachInterrupt(MPU1_INT_PIN, onDataReady1, RISING);


  //These numbers are different to prevent saturation. What if having more detail is good? Could change these around
  mpu1.setAccelerometerRange(MPU6050_RANGE_4_G);
  mpu1.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu1.setFilterBandwidth(MPU6050_BAND_44_HZ); 
  //This is used to set the sample rate to 200 Hz
  mpu1.setSampleRateDivisor(4);

  FFTsetup();
  pinMode(6, OUTPUT);
  digitalWrite(6, HIGH);




}

void loop() {
  // put your main code here, to run repeatedly:
  if (mpu1Interrupt) {
    
    mpu1Interrupt = false;
    mpu1Timestamp = micros();
    sensors_event_t a, g, temp;
    mpu1.getEvent(&a, &g, &temp);

    // Buffer
    addSample(a.acceleration.x,a.acceleration.y, a.acceleration.z);
  }

  if (bufferFull && samplesSinceFFT >= FFT_INTERVAL) {
    samplesSinceFFT = 0;
    runFFT();

    // Compute the band-limited tremor RMS amplitude in m/s^2.
    // This is the meaningful "tremor amplitude" — gravity (DC bin)
    // is excluded because lowerTremor=5, so it's just shake energy
    // in the 4-25 Hz band. This is what gets sent to the app.
    float windowCorrection = 0.375;
    float truePowerT = (2.0f * powerT) / (N * N * windowCorrection);
    float rmsTremor = sqrt(truePowerT);

    tremor10secondAmplitude[tremor10idx] = rmsTremor;

    float ratio = powerT/powerN;
    tremor10second[tremor10idx] = (rmsTremor > powerThreshold && ratio >= ratioThreshold);
    
    float average = 0;

    for (int i =0; i < 20; i++){
      average += tremor10second[i];
    } 
    average = average/20;
    if(average > 0.9) {
      // Average the band-limited amplitudes across the windows that
      // were classified as tremor — gives a stable mean amplitude
      // rather than a single noisy max.
      float sum = 0;
      int divide = 0;
      for(int i = 0; i < 10*2; i++)
      {
        sum += tremor10secondAmplitude[i]*tremor10second[i];
        divide += tremor10second[i];
      }
      float meanAmp = (divide > 0) ? sum / divide : 0;
      if (meanAmp > maxAmplitude){
        maxAmplitude = meanAmp;
      }

      
      tremorHappened= true;
    }


    tremor60counter = 1 + tremor60counter;
    tremor10idx = (tremor10idx + 1) % 20;


  }

  if (tremor60counter >= COUNTER_THRESHOLD) {

    sendTremorPacket();


    tremorHappened = false;
    tremor60counter = 0;
    maxAmplitude = 0;
    

  }



}
