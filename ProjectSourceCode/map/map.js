// Default fallback location (if geolocation unavailable/denied)
const FALLBACK_COORDS = [39.7392, -104.9903]; const FALLBACK_ZOOM = 13;

const map = L.map('map').setView(FALLBACK_COORDS, FALLBACK_ZOOM);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// UI elements to show to user 
let userMarker, accuracyCircle;

// Try Leaflet's locate wrapper which uses the Geolocation API
function locateUser() {
  if (!navigator.geolocation) {
    console.warn('Geolocation not supported by this browser.');
    return;
  }

  // Ask for location, setView will center map on found location
  // maxZoom controls how tightly we zoom in
  map.locate({ setView: true, maxZoom: 16, watch: false, timeout: 10000 });
}

// Successful location event
map.on('locationfound', function (e) {
  const latlng = e.latlng;
  const accuracy = e.accuracy; // meters

  // Remove previous marker/circle if any
  if (userMarker) userMarker.remove();
  if (accuracyCircle) accuracyCircle.remove();

  userMarker = L.marker(latlng)
    .addTo(map)
    .bindPopup('You are here')
    .openPopup();

  accuracyCircle = L.circle(latlng, {
    radius: accuracy,
    weight: 1,
    fillOpacity: 0.15
  }).addTo(map);

  console.log(`Located at ${latlng.lat}, ${latlng.lng} (±${Math.round(accuracy)} m)`);
});


// On error (permission denied, timeout, etc.)
map.on('locationerror', function (e) {
  console.warn('Location error:', e.message);
  // Center to fallback
  map.setView(FALLBACK_COORDS, FALLBACK_ZOOM);
  
});

// Call locate on load (this will prompt the user)
locateUser();

//Add button to return to user location
const locateButton = L.control({ position: 'topleft' });
locateButton.onAdd = function () {
  const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
  div.style.cursor = 'pointer';
  div.style.padding = '6px';
  div.title = 'Center map on your location';
  div.innerHTML = '📍';
  L.DomEvent.on(div, 'click', function (ev) {
    L.DomEvent.stopPropagation(ev);
    map.locate({ setView: true, maxZoom: 16, timeout: 10000 });
  });
  return div;
};
locateButton.addTo(map);

// Define marker icons
const myPrivateIcon = L.icon({
  iconUrl: 'https://maps.gstatic.com/mapfiles/ms2/micons/red-dot.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const myPublicIcon = L.icon({
  iconUrl: 'https://maps.gstatic.com/mapfiles/ms2/micons/green-dot.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const othersIcon = L.icon({
  iconUrl: 'https://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});
