import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import axios from 'axios'
import { Capacitor } from '@capacitor/core'

// Configure Axios base URL for Capacitor (Android/iOS) builds or production
// In local dev, Vite proxy handles '/api' calls. In production or Capacitor,
// VITE_API_URL should be defined in .env (e.g. VITE_API_URL=http://192.168.1.100:5001)
let apiUrl;

if (import.meta.env.PROD) {
  // Strictly enforce the production Render URL to avoid any Vercel environment variable misconfigurations
  apiUrl = 'https://avento-7hnx.onrender.com';
} else if (Capacitor.isNativePlatform()) {
  apiUrl = import.meta.env.VITE_API_URL;
  // Mobile devices cannot reach the host machine via localhost/127.0.0.1.
  // We automatically swap these for the Android Emulator host alias.
  if (!apiUrl || apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
    apiUrl = 'http://10.0.2.2:5001';
  }
} else if (import.meta.env.DEV) {
  // If we are in local browser development (Vite dev server),
  // we should ignore VITE_API_URL and let the proxy handle it
  apiUrl = null;
}

if (apiUrl) {
  axios.defaults.baseURL = apiUrl;
}

// Add interceptor to catch silent network failures on Android
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (Capacitor.isNativePlatform()) {
      // WebView translates Connection Refused to an empty 500 response or status 0
      if (!error.response || (error.response.status === 500 && !error.response.data?.message)) {
        console.error('Android Network Error Detected:', error);
        alert(`Network Error: The Android emulator cannot reach the backend at ${axios.defaults.baseURL}. Please ensure your backend is running, and if you are on a physical device, you must rebuild the APK with VITE_API_URL set to your computer's Wi-Fi IP (e.g. 192.168.x.x:5001) in your .env file.`);
      }
    }
    return Promise.reject(error);
  }
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
