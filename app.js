const map = new kakao.maps.Map(document.getElementById('map'), {
  center: new kakao.maps.LatLng(37.5665, 126.9780),
  level: 8
});
map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
const geocoder = new kakao.maps.services.Geocoder();
const places = new kakao.maps.services.Places();

let origins = [];
let destinations = [];
let addMode = null;
let counter = 0;
let activePopupOverlay = null;
let midpointOverlay = null;
let connectionLines = [];

const originChipsEl = document.getElementById('originChips');
const destChipsEl = document.getElementById('destChips');
const addOriginBtn = document.getElementById('addOriginBtn');
const addDestBtn = document.getElementById('addDestBtn');
const mapBanner = document.getElementById('mapBanner');
const resultArea = document.getElementById('resultArea');
const resultSub = document.getElementById('resultSub');
const drawer = document.getElementById('drawer');
const panelFooter = document.getElementById('panelFooter');
const panelFooterCounts = document.getElementById('panelFooterCounts');
const panelFooterCta = document.getElementById('panelFooterCta');

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function closeMapPopup() {
  if (activePopupOverlay) {
    activePopupOverlay.setMap(null);
    activePopupOverlay = null;
  }
}

function setAddMode(mode) {
  closeMapPopup();
  addMode = mode;
  addOriginBtn.classList.toggle('active', mode === 'origin');
  addDestBtn.classList.toggle('active', mode === 'dest');
  if (mode === 'origin') { mapBanner.textContent = '지도를 클릭해 출발지 위치를 지정하세요'; mapBanner.style.opacity = 1; }
  else if (mode === 'dest') { mapBanner.textContent = '지도를 클릭해 골프장 위치를 지정하세요'; mapBanner.style.opacity = 1; }
  else { mapBanner.style.opacity = 0; }
}

addOriginBtn.addEventListener('click', () => setAddMode(addMode === 'origin' ? null : 'origin'));
addDestBtn.addEventListener('click', () => setAddMode(addMode === 'dest' ? null : 'dest'));

function setDrawerOpen(open) {
  drawer.classList.toggle('open', open);
  let steps = 0;
  const iv = setInterval(() => {
    map.relayout();
    steps++;
    if (steps > 10) clearInterval(iv);
  }, 32);
}

panelFooter.addEventListener('click', () => setDrawerOpen(true));

document.getElementById('drawerCloseMobile').addEventListener('click', () => setDrawerOpen(false));

function svgToMarkerImage(svg, width, height, offsetX, offsetY) {
  const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  return new kakao.maps.MarkerImage(url, new kakao.maps.Size(width, height), { offset: new kakao.maps.Point(offsetX, offsetY) });
}

function originMarkerImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18">`
    + `<circle cx="9" cy="9" r="7" fill="#1476A6" stroke="#F4F2E9" stroke-width="2.5"/></svg>`;
  return svgToMarkerImage(svg, 18, 18, 9, 9);
}

function destMarkerImage(rank) {
  const label = rank ? String(rank) : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="34">`
    + `<path d="M14 0C6.3 0 0 6.3 0 14c0 10 14 20 14 20s14-10 14-20C28 6.3 21.7 0 14 0z" fill="#1E7A46" stroke="#F4F2E9" stroke-width="2"/>`
    + `<text x="14" y="19" text-anchor="middle" font-size="13" font-weight="700" fill="#F4F2E9" font-family="'IBM Plex Mono',monospace">${label}</text></svg>`;
  return svgToMarkerImage(svg, 28, 34, 14, 34);
}

function updateMidpointMarker() {
  if (midpointOverlay) { midpointOverlay.setMap(null); midpointOverlay = null; }
  if (origins.length < 2) return;

  const avgLat = origins.reduce((sum, o) => sum + o.lat, 0) / origins.length;
  const avgLng = origins.reduce((sum, o) => sum + o.lng, 0) / origins.length;

  const el = document.createElement('div');
  el.title = '다 같이 모이기 딱 좋은 어중간한 지점';
  el.style.cssText = 'display:flex; align-items:center; justify-content:center; width:30px; height:30px; background:#F4F2E9; border:2px solid #14231A; border-radius:50%; box-shadow:0 3px 8px rgba(20,35,26,0.35);';
  el.innerHTML = `<svg width="16" height="16" viewBox="0 0 60 60" aria-hidden="true">
    <line x1="12" y1="20" x2="30" y2="34" stroke="#1E7A46" stroke-width="3" stroke-dasharray="4 4"/>
    <line x1="48" y1="20" x2="30" y2="34" stroke="#1476A6" stroke-width="3" stroke-dasharray="4 4"/>
    <line x1="30" y1="54" x2="30" y2="34" stroke="#F0940D" stroke-width="3" stroke-dasharray="4 4"/>
    <circle cx="12" cy="20" r="5" fill="#1E7A46"/>
    <circle cx="48" cy="20" r="5" fill="#1476A6"/>
    <circle cx="30" cy="54" r="5" fill="#F0940D"/>
    <line x1="30" y1="34" x2="30" y2="10" stroke="#F4F2E9" stroke-width="4" stroke-linecap="round"/>
    <path d="M30 10 L44 16 L30 22 Z" fill="#F0940D"/>
    <circle cx="30" cy="34" r="4" fill="#F4F2E9"/>
  </svg>`;

  midpointOverlay = new kakao.maps.CustomOverlay({
    position: new kakao.maps.LatLng(avgLat, avgLng),
    content: el,
    xAnchor: 0.5,
    yAnchor: 0.5,
    zIndex: 200
  });
  midpointOverlay.setMap(map);
}

function clearConnections() {
  connectionLines.forEach(line => line.setMap(null));
  connectionLines = [];
}

function showConnections(dest) {
  clearConnections();
  origins.forEach(o => {
    const line = new kakao.maps.Polyline({
      path: [new kakao.maps.LatLng(o.lat, o.lng), new kakao.maps.LatLng(dest.lat, dest.lng)],
      strokeWeight: 3,
      strokeColor: '#F0940D',
      strokeOpacity: 0.85,
      strokeStyle: 'shortdash'
    });
    line.setMap(map);
    connectionLines.push(line);
  });
}

function addPoint(kind, name, lat, lng, fly) {
  const id = 'p' + (counter++);
  const latlng = new kakao.maps.LatLng(lat, lng);
  const marker = new kakao.maps.Marker({
    position: latlng,
    image: kind === 'origin' ? originMarkerImage() : destMarkerImage(destinations.length + 1),
    map
  });
  const infowindow = new kakao.maps.InfoWindow({ content: `<div style="padding:4px 8px;font-size:12px;">${escapeHtml(name)}</div>` });
  kakao.maps.event.addListener(marker, 'click', () => infowindow.open(map, marker));
  const point = { id, name, lat, lng, marker };
  if (kind === 'origin') origins.push(point); else destinations.push(point);
  if (fly) {
    map.setLevel(Math.min(map.getLevel(), 5));
    map.panTo(latlng);
  }
  renderChips();
  renderResults();
}

function openMapPopup(kind, latlng) {
  closeMapPopup();
  map.panTo(latlng);
  const fallbackName = kind === 'origin' ? '출발지 ' + (origins.length + 1) : '골프장 ' + (destinations.length + 1);
  const label = kind === 'origin' ? '출발지 이름을 입력하세요' : '골프장 이름을 입력하세요';
  const loadingText = '주소 확인 중...';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'box-sizing:border-box; position:relative; width:200px; padding:10px; background:#F4F2E9; border:1px solid rgba(20,35,26,0.32); box-shadow:0 4px 14px rgba(20,35,26,0.25); font-family:Pretendard,sans-serif;';
  wrap.addEventListener('click', (e) => e.stopPropagation());

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', '닫기');
  closeBtn.style.cssText = 'box-sizing:border-box; position:absolute; top:4px; right:6px; border:none; background:none; cursor:pointer; color:#5C6459; font-size:15px; line-height:1; padding:2px;';

  const labelEl = document.createElement('div');
  labelEl.textContent = label;
  labelEl.style.cssText = 'box-sizing:border-box; font-size:11px; font-weight:600; color:#14231A; margin:0 18px 6px 0;';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = loadingText;
  input.style.cssText = 'box-sizing:border-box; display:block; width:100%; padding:6px 8px; border:1px solid rgba(20,35,26,0.32); background:#fff; font-size:12px; margin-bottom:6px; font-family:inherit;';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = '이 위치에 추가';
  confirmBtn.style.cssText = 'box-sizing:border-box; display:block; width:100%; padding:6px 8px; border:1px solid #14231A; background:#14231A; color:#F4F2E9; font-size:11.5px; font-weight:600; cursor:pointer;';

  wrap.append(closeBtn, labelEl, input, confirmBtn);

  function confirm() {
    const raw = input.value.trim();
    const name = (!raw || raw === loadingText) ? fallbackName : raw;
    addPoint(kind, name, latlng.getLat(), latlng.getLng(), false);
    setAddMode(null);
  }

  confirmBtn.addEventListener('click', confirm);
  closeBtn.addEventListener('click', () => setAddMode(null));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirm(); });

  activePopupOverlay = new kakao.maps.CustomOverlay({
    position: latlng,
    content: wrap,
    xAnchor: 0.5,
    yAnchor: 1.25,
    zIndex: 999,
    clickable: true
  });
  activePopupOverlay.setMap(map);
  setTimeout(() => { input.focus(); input.select(); }, 0);

  geocoder.coord2Address(latlng.getLng(), latlng.getLat(), (result, status) => {
    if (input.value !== loadingText) return;
    if (status === kakao.maps.services.Status.OK && result[0]) {
      const r = result[0];
      const buildingName = r.road_address && r.road_address.building_name;
      const addr = (r.road_address && r.road_address.address_name) || (r.address && r.address.address_name) || fallbackName;
      input.value = buildingName || addr;
    } else {
      input.value = fallbackName;
    }
    input.select();
  });
}

kakao.maps.event.addListener(map, 'click', (mouseEvent) => {
  originSearchResults.innerHTML = '';
  destSearchResults.innerHTML = '';
  clearConnections();
  if (!addMode) return;
  openMapPopup(addMode, mouseEvent.latLng);
});

function renderSearchResults(kind, resultsEl, inputEl, hintEl, results) {
  resultsEl._selIndex = -1;
  const itemsHtml = results.map((r, i) => `
    <div class="search-result-item" data-idx="${i}">
      <div class="search-result-name">${escapeHtml(r.place_name)}</div>
      <div class="search-result-addr">${escapeHtml(r.road_address_name || r.address_name || '')}</div>
    </div>
  `).join('');
  resultsEl.innerHTML = `
    <div class="search-results-head">
      <span class="search-results-count mono">${results.length}개 결과</span>
      <button class="search-results-close" aria-label="검색결과 닫기">×</button>
    </div>
    ${itemsHtml}
  `;
  resultsEl.querySelector('.search-results-close').addEventListener('click', () => {
    resultsEl.innerHTML = '';
  });
  resultsEl.querySelectorAll('.search-result-item').forEach(el => {
    el.addEventListener('click', () => {
      const r = results[parseInt(el.dataset.idx, 10)];
      addPoint(kind, r.place_name, parseFloat(r.y), parseFloat(r.x), true);
      hintEl.textContent = '등록됨: ' + r.place_name;
      resultsEl.innerHTML = '';
      inputEl.value = '';
    });
  });
}

function moveSearchResultSelection(resultsEl, delta) {
  const items = [...resultsEl.querySelectorAll('.search-result-item')];
  if (items.length === 0) return;
  const current = resultsEl._selIndex ?? -1;
  const next = Math.max(0, Math.min(current + delta, items.length - 1));
  resultsEl._selIndex = next;
  items.forEach((el, i) => el.classList.toggle('active', i === next));
  items[next].scrollIntoView({ block: 'nearest' });
}

function handleSearchResultsKeydown(e, resultsEl) {
  const items = resultsEl.querySelectorAll('.search-result-item');
  if (items.length === 0) return false;
  if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
    e.preventDefault();
    moveSearchResultSelection(resultsEl, 1);
    return true;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    moveSearchResultSelection(resultsEl, -1);
    return true;
  }
  if (e.key === 'Enter' && resultsEl._selIndex >= 0) {
    e.preventDefault();
    items[resultsEl._selIndex].click();
    return true;
  }
  return false;
}

function isGolfCourse(place) {
  return (place.category_name || '').includes('골프');
}

function geocodeAndAdd(kind, query, inputEl, hintEl, goBtn, resultsEl) {
  const q = query.trim();
  resultsEl.innerHTML = '';
  if (!q) return;
  goBtn.disabled = true;
  hintEl.textContent = '검색 중...';
  places.keywordSearch(q, (data, status) => {
    goBtn.disabled = false;
    if (status !== kakao.maps.services.Status.OK || !data || data.length === 0) {
      hintEl.textContent = '"' + q + '"의 검색 결과가 없습니다. 다르게 입력해보세요.';
      return;
    }
    const results = kind === 'dest'
      ? [...data].sort((a, b) => isGolfCourse(b) - isGolfCourse(a))
      : data;
    hintEl.textContent = data.length + '개 결과 중에서 선택하세요.';
    renderSearchResults(kind, resultsEl, inputEl, hintEl, results.slice(0, 8));
  });
}

const originAddrInput = document.getElementById('originAddrInput');
const originAddrGo = document.getElementById('originAddrGo');
const originAddrHint = document.getElementById('originAddrHint');
const originSearchResults = document.getElementById('originSearchResults');
const destAddrInput = document.getElementById('destAddrInput');
const destAddrGo = document.getElementById('destAddrGo');
const destAddrHint = document.getElementById('destAddrHint');
const destSearchResults = document.getElementById('destSearchResults');

let originSearchTimer = null;
let destSearchTimer = null;

function submitOriginAddr() {
  clearTimeout(originSearchTimer);
  geocodeAndAdd('origin', originAddrInput.value, originAddrInput, originAddrHint, originAddrGo, originSearchResults);
}
function submitDestAddr() {
  clearTimeout(destSearchTimer);
  geocodeAndAdd('dest', destAddrInput.value, destAddrInput, destAddrHint, destAddrGo, destSearchResults);
}
originAddrGo.addEventListener('click', submitOriginAddr);
destAddrGo.addEventListener('click', submitDestAddr);
originAddrInput.addEventListener('keydown', (e) => {
  if (handleSearchResultsKeydown(e, originSearchResults)) return;
  if (e.key === 'Enter') submitOriginAddr();
});
destAddrInput.addEventListener('keydown', (e) => {
  if (handleSearchResultsKeydown(e, destSearchResults)) return;
  if (e.key === 'Enter') submitDestAddr();
});
originAddrInput.addEventListener('input', () => {
  originSearchResults.innerHTML = '';
  clearTimeout(originSearchTimer);
  if (!originAddrInput.value.trim()) { originAddrHint.textContent = ''; return; }
  originSearchTimer = setTimeout(submitOriginAddr, 350);
});
destAddrInput.addEventListener('input', () => {
  destSearchResults.innerHTML = '';
  clearTimeout(destSearchTimer);
  if (!destAddrInput.value.trim()) { destAddrHint.textContent = ''; return; }
  destSearchTimer = setTimeout(submitDestAddr, 350);
});

function removePoint(id, listName) {
  const list = listName === 'origin' ? origins : destinations;
  const idx = list.findIndex(p => p.id === id);
  if (idx === -1) return;
  list[idx].marker.setMap(null);
  list.splice(idx, 1);
  renderChips();
  renderResults();
}

function renderChips() {
  originChipsEl.innerHTML = origins.map(chipHtml).join('');
  destChipsEl.innerHTML = destinations.map(chipHtml).join('');
  originChipsEl.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => removePoint(btn.dataset.id, 'origin')));
  destChipsEl.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => removePoint(btn.dataset.id, 'dest')));
}

function chipHtml(p) {
  return `<span class="chip">${escapeHtml(p.name)}<button data-id="${p.id}" aria-label="삭제">×</button></span>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

let currentSort = 'fair';
const sortPills = document.querySelectorAll('.sort-pill');
const sortDetails = document.querySelectorAll('.sort-detail');
const sortWhyToggle = document.getElementById('sortWhyToggle');
const sortDetailWrap = document.getElementById('sortDetailWrap');

function setSort(value) {
  currentSort = value;
  sortPills.forEach(p => p.classList.toggle('active', p.dataset.value === value));
  sortDetails.forEach(d => d.classList.toggle('active', d.dataset.value === value));
  renderResults();
}

sortPills.forEach(pill => pill.addEventListener('click', () => setSort(pill.dataset.value)));

sortWhyToggle.addEventListener('click', () => {
  const expanded = sortWhyToggle.getAttribute('aria-expanded') === 'true';
  sortWhyToggle.setAttribute('aria-expanded', String(!expanded));
  sortDetailWrap.hidden = expanded;
});

drawer.addEventListener('transitionend', (e) => {
  if (e.propertyName === 'width') map.relayout();
});

function renderResults() {
  updateMidpointMarker();
  panelFooterCounts.textContent = `출발 ${origins.length} · 목적지 ${destinations.length}`;
  panelFooterCta.textContent = (origins.length === 0 || destinations.length === 0)
    ? '출발지, 목적지를 선택해주세요'
    : '거리계산 준비됨 →';

  if (origins.length === 0 || destinations.length === 0) {
    resultSub.textContent = '직선거리(km) 기준';
    resultArea.innerHTML = `<div class="empty-state">아직 ${origins.length === 0 ? '출발지가' : '목적지가'} 등록되지 않았습니다. 왼쪽 패널에서 위치를 추가하면 이곳에 결과가 표시됩니다.</div>`;
    return;
  }

  const rows = destinations.map(dest => {
    const dists = origins.map(o => ({ name: o.name, km: haversine(o.lat, o.lng, dest.lat, dest.lng) }));
    const values = dists.map(d => d.km);
    const avg = values.reduce((a,b) => a+b, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const spread = max - min;
    return { dest, dists, avg, max, spread };
  });

  const sortKey = currentSort;
  const sorted = [...rows].sort((a, b) => {
    if (sortKey === 'fair') return a.spread - b.spread;
    if (sortKey === 'avg') return a.avg - b.avg;
    return a.max - b.max;
  });

  const metricLabel = sortKey === 'fair' ? '편차' : sortKey === 'avg' ? '평균' : '최대';
  resultSub.textContent = `골프장 ${destinations.length} · 출발지 ${origins.length} · 직선거리(km)`;

  sorted.forEach((row, i) => row.dest.marker.setImage(destMarkerImage(i + 1)));
  clearConnections();

  resultArea.innerHTML = sorted.map((row, i) => {
    const metricVal = sortKey === 'fair' ? row.spread : sortKey === 'avg' ? row.avg : row.max;
    const distSpans = row.dists.map(d => `<span>${escapeHtml(d.name)} <b>${d.km.toFixed(1)}km</b></span>`).join('');
    return `<div class="result-card" data-dest-id="${row.dest.id}">
      <div class="result-rank mono">${i+1}</div>
      <div class="result-body">
        <div class="result-name">${escapeHtml(row.dest.name)}</div>
        <div class="result-dists">${distSpans}</div>
        <span class="result-metric">${metricLabel} ${metricVal.toFixed(1)}km</span>
      </div>
    </div>`;
  }).join('');

  resultArea.querySelectorAll('.result-card').forEach(card => {
    const dest = destinations.find(d => d.id === card.dataset.destId);
    if (!dest) return;
    card.addEventListener('mouseenter', () => showConnections(dest));
    card.addEventListener('mouseleave', clearConnections);
    card.addEventListener('click', () => showConnections(dest));
  });
}

renderChips();
renderResults();
