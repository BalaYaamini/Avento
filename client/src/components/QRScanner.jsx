import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const QRScanner = ({ onScanSuccess, onScanFailure }) => {
  const scannerRef = useRef(null);

  useEffect(() => {
    // Create instance of Html5Qrcode
    const html5QrCode = new Html5Qrcode('qr-reader');
    let isScanning = false;

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" }, // Prefer back camera
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (isScanning) {
              isScanning = false;
              html5QrCode.stop().then(() => {
                if (onScanSuccess) onScanSuccess(decodedText);
              }).catch(err => console.error("Failed to stop scanner", err));
            }
          },
          (errorMessage) => {
            if (onScanFailure) onScanFailure(errorMessage);
          }
        );
        isScanning = true;
      } catch (err) {
        console.error("Error starting scanner:", err);
      }
    };

    startScanner();

    return () => {
      if (isScanning || html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error("Failed to stop on unmount", err));
      }
    };
  }, [onScanSuccess, onScanFailure]);

  return <div id="qr-reader" ref={scannerRef} className="w-full"></div>;
};

export default QRScanner;
