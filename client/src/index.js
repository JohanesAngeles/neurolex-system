import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Import your logo - update the path to match your actual logo file location
import logo from './assets/images/neurolex_solid_logo.png'; // Change 'your-logo.png' to your actual file name

// Set favicon dynamically
const favicon = document.querySelector('link[rel="icon"]');
if (favicon) {
  favicon.href = logo;
} else {
  const newFavicon = document.createElement('link');
  newFavicon.rel = 'icon';
  newFavicon.href = logo;
  document.head.appendChild(newFavicon);
}

// Set the document title
document.title = 'Neurolex'; // Replace with your app name

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();