// src/lib/notifier.js

const NOTIFIER_PREFIX = "linkedin-scraper-notifier";
const NOTIFIER_STYLE_ID = `${NOTIFIER_PREFIX}-style`;

function injectStyles() {
  if (document.getElementById(NOTIFIER_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = NOTIFIER_STYLE_ID;
  style.textContent = `
    .${NOTIFIER_PREFIX} {
      position: fixed;
      background: #ff4757;
      color: white;
      padding: 15px;
      border-radius: 5px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      pointer-events: auto;
      max-width: 300px;
    }

    .${NOTIFIER_PREFIX}--toast {
      top: 20px;
      right: 20px;
    }

    .${NOTIFIER_PREFIX}--modal {
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      padding: 20px;
    }
  `;
  document.head.appendChild(style);
}

function showNotification({
  id,
  type = "toast",
  title,
  message,
  details,
  duration = 10000,
}) {
  injectStyles();

  const existing = document.getElementById(id);
  if (existing) {
    console.log(`Notifier: message with id "${id}" already shown.`);
    return;
  }

  const notification = document.createElement("div");
  notification.id = id;
  notification.className = `${NOTIFIER_PREFIX} ${NOTIFIER_PREFIX}--${type}`;

  let html = "";
  if (title) {
    html += `<strong>${title}</strong><br>`;
  }
  if (message) {
    html += `${message}`;
  }
  if (details) {
    html += `<br><small>${details}</small>`;
  }
  notification.innerHTML = html;

  document.body.appendChild(notification);

  if (duration > 0) {
    const timeoutId = setTimeout(() => {
      cleanupNotification(id);
    }, duration);
    notification._timeoutId = timeoutId;
  }

  return notification;
}

function cleanupNotification(id) {
  const notification = document.getElementById(id);
  if (notification) {
    if (notification._timeoutId) {
      clearTimeout(notification._timeoutId);
    }
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }
}

function cleanupAll() {
  const notifications = document.querySelectorAll(`.${NOTIFIER_PREFIX}`);
  notifications.forEach((el) => cleanupNotification(el.id));
}

window.LinkedInScraperNotifier = {
  show: showNotification,
  cleanup: cleanupNotification,
  cleanupAll,
};
