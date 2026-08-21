import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const QRScanner = ({ onScanSuccess, onScanFailure }) => {
  const scannerRef = useRef(null);
  const onScanSuccessRef = useRef(onScanSuccess);
  const onScanFailureRef = useRef(onScanFailure);
  const lastScannedTextRef = useRef('');
  const lastScanTimeRef = useRef(0);

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
    onScanFailureRef.current = onScanFailure;
  }, [onScanSuccess, onScanFailure]);

  useEffect(() => {
    let isMounted = true;
    let html5QrCode = null;

    // Helper to explicitly stop all camera MediaStream tracks on any video element inside container
    const stopMediaTracks = () => {
      try {
        if (scannerRef.current) {
          const videoEls = scannerRef.current.querySelectorAll('video');
          videoEls.forEach((video) => {
            if (video.srcObject && typeof video.srcObject.getTracks === 'function') {
              video.srcObject.getTracks().forEach((track) => {
                track.stop();
              });
              video.srcObject = null;
            }
          });
        }
      } catch (err) {
        console.warn('Error stopping camera MediaStream tracks:', err.message);
      }
    };

    const startScanner = async () => {
      try {
        const elementId = 'qr-reader';
        html5QrCode = new Html5Qrcode(elementId);

        // Performance-optimized camera scan config
        const config = {
          fps: 25,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const boxSize = Math.floor(minEdge * 0.75);
            return { width: boxSize, height: boxSize };
          },
          aspectRatio: 1.0,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (isMounted) {
              const now = Date.now();
              // Prevent rapid duplicate scans for the exact same QR within 2.5 seconds, or consecutive scans within 1.5 seconds
              if (
                decodedText === lastScannedTextRef.current &&
                now - lastScanTimeRef.current < 2500
              ) {
                return;
              }
              if (now - lastScanTimeRef.current < 1500) {
                return;
              }

              lastScannedTextRef.current = decodedText;
              lastScanTimeRef.current = now;

              if (onScanSuccessRef.current) {
                onScanSuccessRef.current(decodedText);
              }
            }
          },
          (errorMessage) => {
            if (isMounted && onScanFailureRef.current) {
              onScanFailureRef.current(errorMessage);
            }
          }
        );

        // EDGE CASE SAFEGUARD: If component unmounted while start() was asynchronously resolving
        if (!isMounted && html5QrCode) {
          if (html5QrCode.isScanning) {
            await html5QrCode.stop().catch(() => {});
          }
          await html5QrCode.clear().catch(() => {});
          stopMediaTracks();
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error starting QR scanner:', err.message);
        } else {
          stopMediaTracks();
        }
      }
    };

    startScanner();

    // CLEANUP ON UNMOUNT / CLOSE MODAL
    return () => {
      isMounted = false;
      stopMediaTracks();

      if (html5QrCode) {
        const scannerInstance = html5QrCode;
        html5QrCode = null;

        const performCleanup = async () => {
          try {
            if (scannerInstance.isScanning) {
              await scannerInstance.stop();
            }
            await scannerInstance.clear();
          } catch (e) {
            // Ignore error if already stopped/cleared
          } finally {
            stopMediaTracks();
          }
        };

        performCleanup();
      }
    };
  }, []);

  return <div id="qr-reader" ref={scannerRef} className="w-full"></div>;
};

export default QRScanner;
