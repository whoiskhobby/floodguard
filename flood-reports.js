const form = document.getElementById("photo-report-form");
const imageInput = document.getElementById("flood-image");
const startCameraButton = document.getElementById("start-camera-btn");
const capturePhotoButton = document.getElementById("capture-photo-btn");
const stopCameraButton = document.getElementById("stop-camera-btn");
const cameraPreview = document.getElementById("camera-preview");
const cameraCanvas = document.getElementById("camera-canvas");
const capturedPhotoPreview = document.getElementById("captured-photo-preview");
const locationInput = document.getElementById("flood-location");
const noteInput = document.getElementById("flood-note");
const statusText = document.getElementById("photo-report-status");
const reportList = document.getElementById("photo-report-list");

const STORAGE_KEY = "ghanaFloodPhotoReports";
const USER_ID_STORAGE_KEY = "ghanaFloodPhotoReportUserId";
const MAX_REPORTS = 40;
const GHANA_BOUNDS = { minLat: 4.4, maxLat: 11.5, minLon: -3.4, maxLon: 1.4 };
const LOCATION_ALIASES = {
  circle: { name: "Kwame Nkrumah Circle", latitude: 5.5706, longitude: -0.2095 },
  "accra circle": { name: "Kwame Nkrumah Circle", latitude: 5.5706, longitude: -0.2095 },
  aboabo: { name: "Aboabo, Kumasi", latitude: 6.7035, longitude: -1.6159 },
  "aboabo kumasi": { name: "Aboabo, Kumasi", latitude: 6.7035, longitude: -1.6159 },
};

const currentUserId = getOrCreateCurrentUserId();
let map = null;
let markersLayer = null;
let cameraStream = null;
let capturedPhotoDataUrl = "";

ensureMap();
renderReports();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusText.textContent = "Saving report...";

  const location = locationInput.value.trim();
  const note = noteInput.value.trim();
  const imageFile = imageInput.files && imageInput.files[0];

  if (!location || (!imageFile && !capturedPhotoDataUrl)) {
    statusText.textContent = "Please select or capture an image and enter location.";
    return;
  }

  try {
    const coords = await resolveGhanaLocation(location);
    const imageDataUrl = capturedPhotoDataUrl || (await readImageAsDataUrl(imageFile));
    const compressedImage = await compressImage(imageDataUrl, 900, 0.78);

    const reports = loadReports();
    reports.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      ownerId: currentUserId,
      locationLabel: coords.name || location,
      originalLocationText: location,
      latitude: coords.latitude,
      longitude: coords.longitude,
      note,
      imageDataUrl: compressedImage,
      createdAt: new Date().toISOString(),
    });

    saveReports(reports.slice(0, MAX_REPORTS));
    form.reset();
    clearCapturedPhoto();
    stopCamera();
    statusText.textContent = "Flood photo report saved and mapped.";
    renderReports();
  } catch (error) {
    statusText.textContent =
      error instanceof Error ? error.message : "Could not save report.";
  }
});

reportList.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view-id]");
  if (viewButton) {
    const reportId = viewButton.getAttribute("data-view-id");
    if (reportId) {
      focusReportOnMap(reportId);
    }
    return;
  }

  const deleteButton = event.target.closest("[data-delete-id]");
  if (deleteButton) {
    const reportId = deleteButton.getAttribute("data-delete-id");
    if (reportId) {
      deleteReport(reportId);
    }
  }
});

if (startCameraButton) {
  startCameraButton.addEventListener("click", startCamera);
}

if (capturePhotoButton) {
  capturePhotoButton.addEventListener("click", capturePhotoFromCamera);
}

if (stopCameraButton) {
  stopCameraButton.addEventListener("click", stopCamera);
}

if (imageInput) {
  imageInput.addEventListener("change", () => {
    if (imageInput.files && imageInput.files[0]) {
      clearCapturedPhoto();
    }
  });
}

function ensureMap() {
  if (map || !window.L) {
    return;
  }

  map = window.L.map("photo-report-map", { zoomControl: true }).setView([7.95, -1.03], 7);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
  markersLayer = window.L.layerGroup().addTo(map);
}

function renderReports() {
  const reports = loadReports();
  const markerMap = new Map();
  reportList.innerHTML = "";
  markersLayer.clearLayers();

  if (!reports.length) {
    const empty = document.createElement("p");
    empty.className = "report-time";
    empty.textContent = "No photo reports saved yet.";
    reportList.appendChild(empty);
    return;
  }

  const markerBounds = [];
  reports.forEach((report) => {
    const marker = window.L.marker([report.latitude, report.longitude]).addTo(markersLayer);
    marker.bindPopup(`
      <strong>${escapeHtml(report.locationLabel)}</strong><br/>
      <small>${new Date(report.createdAt).toLocaleString()}</small><br/>
      <img src="${report.imageDataUrl}" alt="Flood report" style="width:120px;height:auto;border-radius:8px;margin-top:6px;" />
      ${report.note ? `<p style="margin:6px 0 0;">${escapeHtml(report.note)}</p>` : ""}
    `);

    markerBounds.push([report.latitude, report.longitude]);
    markerMap.set(report.id, marker);

    const card = document.createElement("article");
    card.className = "photo-report-item";

    const isOwner = !report.ownerId || report.ownerId === currentUserId;
    card.innerHTML = `
      <img src="${report.imageDataUrl}" alt="Flood scene at ${escapeHtml(report.locationLabel)}" />
      <div class="photo-report-content">
        <p class="report-headline">${escapeHtml(report.locationLabel)}</p>
        <p class="report-time">${new Date(report.createdAt).toLocaleString()}</p>
        ${report.note ? `<p class="report-body">${escapeHtml(report.note)}</p>` : ""}
        <div class="report-actions">
          <button type="button" class="btn btn-secondary btn-small" data-view-id="${report.id}">View on Map</button>
          ${
            isOwner
              ? `<button type="button" class="btn btn-danger btn-small" data-delete-id="${report.id}" title="Delete this report">Delete</button>`
              : ""
          }
        </div>
      </div>
    `;

    reportList.appendChild(card);
  });

  reportList._markerMap = markerMap;

  if (markerBounds.length > 1) {
    map.fitBounds(markerBounds, { padding: [20, 20] });
  } else {
    map.setView(markerBounds[0], 13);
  }
}

function focusReportOnMap(reportId) {
  const reports = loadReports();
  const report = reports.find((item) => String(item.id) === String(reportId));
  if (!report) {
    return;
  }

  map.setView([report.latitude, report.longitude], 14);
  const marker = reportList._markerMap && reportList._markerMap.get(report.id);
  if (marker) {
    marker.openPopup();
  }
}

function deleteReport(reportId) {
  const reports = loadReports();
  const target = reports.find((item) => String(item.id) === String(reportId));
  if (!target) {
    statusText.textContent = "Report not found.";
    return;
  }

  const isOwner = !target.ownerId || target.ownerId === currentUserId;
  if (!isOwner) {
    statusText.textContent = "You can only delete reports you posted.";
    return;
  }

  const confirmed = window.confirm("Delete this saved photo report?");
  if (!confirmed) {
    return;
  }

  const updated = reports.filter((item) => String(item.id) !== String(reportId));
  saveReports(updated);
  statusText.textContent = "Photo report deleted.";
  renderReports();
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusText.textContent = "Camera is not supported on this browser/device.";
    return;
  }

  try {
    stopCamera();
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    cameraPreview.srcObject = cameraStream;
    cameraPreview.classList.remove("hidden");
    capturePhotoButton.classList.remove("hidden");
    stopCameraButton.classList.remove("hidden");
    startCameraButton.classList.add("hidden");
    clearCapturedPhoto();
    statusText.textContent = "Camera ready. Capture when focused on flood scene.";
  } catch (_error) {
    statusText.textContent = "Could not access camera. Check permissions.";
  }
}

function capturePhotoFromCamera() {
  if (!cameraStream || !cameraPreview.videoWidth || !cameraPreview.videoHeight) {
    statusText.textContent = "Camera is not ready yet.";
    return;
  }

  cameraCanvas.width = cameraPreview.videoWidth;
  cameraCanvas.height = cameraPreview.videoHeight;
  const context = cameraCanvas.getContext("2d");
  if (!context) {
    statusText.textContent = "Could not capture image.";
    return;
  }

  context.drawImage(cameraPreview, 0, 0, cameraCanvas.width, cameraCanvas.height);
  capturedPhotoDataUrl = cameraCanvas.toDataURL("image/jpeg", 0.9);
  capturedPhotoPreview.src = capturedPhotoDataUrl;
  capturedPhotoPreview.classList.remove("hidden");
  imageInput.value = "";
  statusText.textContent = "Photo captured. Fill location and save report.";
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  if (cameraPreview) {
    cameraPreview.srcObject = null;
    cameraPreview.classList.add("hidden");
  }
  if (capturePhotoButton) {
    capturePhotoButton.classList.add("hidden");
  }
  if (stopCameraButton) {
    stopCameraButton.classList.add("hidden");
  }
  if (startCameraButton) {
    startCameraButton.classList.remove("hidden");
  }
}

function clearCapturedPhoto() {
  capturedPhotoDataUrl = "";
  capturedPhotoPreview.src = "";
  capturedPhotoPreview.classList.add("hidden");
}

async function resolveGhanaLocation(query) {
  const aliasMatch = getAliasCoordinates(query);
  if (aliasMatch) {
    return aliasMatch;
  }

  const normalizedQuery = query.toLowerCase().includes("ghana")
    ? query
    : `${query}, Ghana`;

  const providers = [geocodeByOpenMeteo, geocodeByNominatim];
  for (const provider of providers) {
    const result = await provider(normalizedQuery).catch(() => null);
    if (!result) {
      continue;
    }
    if (!isWithinGhana(result.latitude, result.longitude)) {
      continue;
    }
    return result;
  }

  throw new Error("Location not found in Ghana. Try nearby landmarks.");
}

function getAliasCoordinates(query) {
  const key = normalizePlaceKey(query);
  let alias = LOCATION_ALIASES[key];
  if (!alias) {
    const matchedKey = Object.keys(LOCATION_ALIASES).find((candidate) =>
      key.includes(candidate),
    );
    alias = matchedKey ? LOCATION_ALIASES[matchedKey] : null;
  }

  if (!alias) {
    return null;
  }

  return {
    name: alias.name,
    latitude: alias.latitude,
    longitude: alias.longitude,
  };
}

async function geocodeByOpenMeteo(query) {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?count=1&countryCode=GH&name=" +
    encodeURIComponent(query);
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  if (!data.results || !data.results.length) {
    return null;
  }
  const first = data.results[0];
  return {
    name: first.name,
    latitude: first.latitude,
    longitude: first.longitude,
  };
}

async function geocodeByNominatim(query) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gh&q=" +
    encodeURIComponent(query);
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  if (!Array.isArray(data) || !data.length) {
    return null;
  }
  const first = data[0];
  return {
    name: (first.display_name || query).split(",")[0].trim(),
    latitude: Number(first.lat),
    longitude: Number(first.lon),
  };
}

function loadReports() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function saveReports(reports) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

function getOrCreateCurrentUserId() {
  let id = localStorage.getItem(USER_ID_STORAGE_KEY);
  if (id) {
    return id;
  }
  id = `user-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  localStorage.setItem(USER_ID_STORAGE_KEY, id);
  return id;
}

function isWithinGhana(latitude, longitude) {
  return (
    latitude >= GHANA_BOUNDS.minLat &&
    latitude <= GHANA_BOUNDS.maxLat &&
    longitude >= GHANA_BOUNDS.minLon &&
    longitude <= GHANA_BOUNDS.maxLon
  );
}

function normalizePlaceKey(value) {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read selected image."));
    reader.readAsDataURL(file);
  });
}

function compressImage(dataUrl, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Could not process image."));
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => reject(new Error("Could not process image."));
    image.src = dataUrl;
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
