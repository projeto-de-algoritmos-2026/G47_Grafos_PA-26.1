const API_BASE = "http://localhost:5000";

const COLORS = {
  dijkstra: "#534AB7",
  bfs: "#1D9E75",
};

const map = L.map("map").setView([-15.76, -47.87], 15);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);

let origin = null;
let destination = null;
let polylines = {};
let selectedAlgo = "dijkstra";

const labelOrigin   = document.getElementById("label-origin");
const labelDest     = document.getElementById("label-dest");
const statusBar     = document.getElementById("status-bar");
const statusBarQuick = document.getElementById("status-bar-quick");
const resultsEl     = document.getElementById("results");
const cardDijkstra  = document.getElementById("result-dijkstra");
const cardBfs       = document.getElementById("result-bfs");
const btnClear      = document.getElementById("btn-clear");
const infoQuick     = document.getElementById("info-quick");
const advancedPanel = document.getElementById("advanced-panel");
const btnTogglePanel = document.getElementById("btn-toggle-panel");

let advancedVisible = false;

function makeIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};border:2px solid #fff;
      box-shadow:0 0 0 2px ${color};
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const originIcon = makeIcon("#2563eb");
const destIcon   = makeIcon("#dc2626");

document.querySelectorAll(".algo-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".algo-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedAlgo = btn.dataset.algo;

    if (origin && destination) {
      runRoute();
    }
  });
});

btnTogglePanel.addEventListener("click", () => {
  advancedVisible = !advancedVisible;
  advancedPanel.classList.toggle("hidden", !advancedVisible);
  btnTogglePanel.textContent = advancedVisible ? "Ocultar" : "Avançado";
});

map.on("click", (e) => {
  const latlng = e.latlng;

  if (!origin) {
    setOrigin(latlng);
  } else if (!destination) {
    setDestination(latlng);
    runRoute();
  } else {
    clearAll();
    setOrigin(latlng);
  }
});

function setOrigin(latlng) {
  if (origin) origin.marker.remove();
  const marker = L.marker(latlng, { icon: originIcon }).addTo(map);
  origin = { latlng, marker };
  labelOrigin.textContent = formatCoord(latlng);
  infoQuick.textContent = "Agora clique no destino.";
}

function setDestination(latlng) {
  if (destination) destination.marker.remove();
  const marker = L.marker(latlng, { icon: destIcon }).addTo(map);
  destination = { latlng, marker };
  labelDest.textContent = formatCoord(latlng);
  infoQuick.textContent = "Calculando rota...";
}

btnClear.addEventListener("click", clearAll);

function clearAll() {
  if (origin)      { origin.marker.remove();      origin = null; }
  if (destination) { destination.marker.remove(); destination = null; }

  Object.values(polylines).forEach((p) => p.remove());
  polylines = {};

  labelOrigin.textContent = "Clique no mapa para definir a origem";
  labelDest.textContent   = "Clique no mapa para definir o destino";
  infoQuick.textContent = "Clique em um ponto inicial no mapa.";

  resultsEl.classList.add("hidden");
  cardDijkstra.classList.add("hidden");
  cardBfs.classList.add("hidden");
  hideStatus();
}

async function runRoute() {
  if (!origin || !destination) return;

  const { lat: slat, lng: slng } = origin.latlng;
  const { lat: tlat, lng: tlng } = destination.latlng;
  const params = `slat=${slat}&slng=${slng}&tlat=${tlat}&tlng=${tlng}`;

  Object.values(polylines).forEach((p) => p.remove());
  polylines = {};

  hideStatus();
  resultsEl.classList.add("hidden");
  cardDijkstra.classList.add("hidden");
  cardBfs.classList.add("hidden");

  showStatus("Calculando rota...", "loading");

  try {
    if (selectedAlgo === "dijkstra" || selectedAlgo === "both") {
      const data = await fetchJSON(`${API_BASE}/shortest-path?${params}`);
      drawPolyline(data.path, "dijkstra");
      showDijkstraResult(data);
      if (selectedAlgo === "dijkstra") {
        infoQuick.textContent = `Rota encontrada! Distância: ${data.distance_m} m`;
      }
    }

    if (selectedAlgo === "bfs" || selectedAlgo === "both") {
      const data = await fetchJSON(`${API_BASE}/bfs-path?${params}`);
      drawPolyline(data.path, "bfs");
      showBfsResult(data);
      if (selectedAlgo === "bfs") {
        infoQuick.textContent = `Rota encontrada! Saltos: ${data.steps - 1}`;
      }
    }

    if (selectedAlgo === "both") {
      infoQuick.textContent = "As duas rotas foram desenhadas. Compare as linhas no mapa.";
    }

    resultsEl.classList.remove("hidden");
    hideStatus();
  } catch (err) {
    showStatus(err.message || "Erro ao calcular a rota.", "error");
  }
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function drawPolyline(coords, algo) {
  if (!coords || coords.length === 0) return;
  const line = L.polyline(coords, {
    color: COLORS[algo],
    weight: 5,
    opacity: 0.85,
  }).addTo(map);
  polylines[algo] = line;

  if (selectedAlgo !== "both") {
    map.fitBounds(line.getBounds(), { padding: [40, 40] });
  }
}

function fitBothBounds() {
  const all = Object.values(polylines);
  if (all.length === 0) return;
  const combined = all.reduce((acc, p) => acc.extend(p.getBounds()), L.latLngBounds());
  map.fitBounds(combined, { padding: [40, 40] });
}

function showDijkstraResult(data) {
  document.getElementById("d-dist").textContent    = `${data.distance_m} m`;
  document.getElementById("d-visited").textContent = data.nodes_visited;
  document.getElementById("d-steps").textContent   = data.path.length;
  cardDijkstra.classList.remove("hidden");
}

function showBfsResult(data) {
  document.getElementById("b-hops").textContent    = data.steps - 1;
  document.getElementById("b-visited").textContent = data.nodes_visited;
  document.getElementById("b-steps").textContent   = data.steps;
  cardBfs.classList.remove("hidden");
}

function showStatus(msg, type = "loading") {
  statusBar.textContent = msg;
  statusBar.className = `status ${type}`;
  statusBar.classList.remove("hidden");

  statusBarQuick.textContent = msg;
  statusBarQuick.className = `status ${type}`;
  statusBarQuick.classList.remove("hidden");
}

function hideStatus() {
  statusBar.classList.add("hidden");
  statusBarQuick.classList.add("hidden");
}

function formatCoord(latlng) {
  return `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
}

(function patchRunRoute() {
  const orig = runRoute;
  runRoute = async function () {
    await orig();
    if (selectedAlgo === "both") fitBothBounds();
  };
})();
