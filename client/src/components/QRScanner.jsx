import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

const QRScanner = ({ onScanSuccess, onScanFailure }) => {
  const scannerRef = useRef(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );
    
    scanner.render(
      (decodedText) => {
        scanner.clear();
        if (onScanSuccess) onScanSuccess(decodedText);
      },
      (error) => {
        if (onScanFailure) onScanFailure(error);
      }
    );

    return () => {
      try {
        scanner.clear();
      } catch (error) {
        console.error("Failed to clear html5QrcodeScanner.", error);
      }
    };
  }, [onScanSuccess, onScanFailure]);

  return <div id="qr-reader" ref={scannerRef} className="w-full"></div>;
};

export default QRScanner;
