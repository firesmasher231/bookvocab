import Quagga from '@ericblade/quagga2';

let isInitialized = false;
let detectionCallback = null;

/**
 * Initialize and start the barcode scanner
 * @param {HTMLElement} videoElement - Video element or container to display camera feed
 * @param {Function} onDetected - Callback when barcode is detected
 * @param {Function} onError - Callback for errors
 * @returns {Promise<void>}
 */
export async function initScanner(videoElement, onDetected, onError) {
  if (isInitialized) {
    console.warn('Scanner already initialized');
    return;
  }

  detectionCallback = onDetected;

  // Request camera permission first
  try {
    await navigator.mediaDevices.getUserMedia({ video: true });
  } catch (error) {
    onError(new Error('Camera permission denied. Please allow camera access to scan barcodes.'));
    return;
  }

  const config = {
    inputStream: {
      name: 'Live',
      type: 'LiveStream',
      target: videoElement,
      constraints: {
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 },
        facingMode: 'environment', // Use back camera on mobile
        aspectRatio: { min: 1, max: 2 },
      },
    },
    decoder: {
      readers: [
        'ean_reader',      // EAN-13 (ISBN-13)
        'ean_8_reader',    // EAN-8
      ],
      multiple: false,
    },
    locator: {
      patchSize: 'medium',
      halfSample: true,
    },
    numOfWorkers: navigator.hardwareConcurrency || 2,
    frequency: 10,
    locate: true,
  };

  return new Promise((resolve, reject) => {
    Quagga.init(config, (err) => {
      if (err) {
        console.error('Scanner initialization failed:', err);
        onError(new Error('Failed to initialize camera scanner. Please try again.'));
        reject(err);
        return;
      }

      // Start scanning
      Quagga.start();
      isInitialized = true;

      // Set up detection handler
      Quagga.onDetected(handleDetection);

      resolve();
    });
  });
}

/**
 * Handle barcode detection
 * @param {Object} result - Quagga detection result
 */
function handleDetection(result) {
  if (!result || !result.codeResult) return;

  const code = result.codeResult.code;

  // Validate ISBN format (13 digits for ISBN-13, 10 for ISBN-10)
  if (code && (code.length === 13 || code.length === 10)) {
    // Only trigger callback for high-confidence detections
    if (result.codeResult.confidence && result.codeResult.confidence > 0.7) {
      if (detectionCallback) {
        detectionCallback({
          isbn: code,
          format: code.length === 13 ? 'ISBN-13' : 'ISBN-10',
          confidence: result.codeResult.confidence,
        });
      }
    }
  }
}

/**
 * Stop the barcode scanner
 */
export function stopScanner() {
  if (!isInitialized) return;

  Quagga.stop();
  Quagga.offDetected(handleDetection);
  isInitialized = false;
  detectionCallback = null;
}

/**
 * Check if camera is available
 * @returns {Promise<boolean>}
 */
export async function isCameraAvailable() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some(device => device.kind === 'videoinput');
  } catch (error) {
    return false;
  }
}

/**
 * Check if scanner is currently active
 * @returns {boolean}
 */
export function isScannerActive() {
  return isInitialized;
}

/**
 * Request camera permission
 * @returns {Promise<boolean>}
 */
export async function requestCameraPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    // Stop the stream immediately, we just wanted to check permission
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error('Camera permission error:', error);
    return false;
  }
}
