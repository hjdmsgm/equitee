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

function markerImage(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">`
    + `<rect x="3" y="3" width="14" height="14" fill="${color}" stroke="#F4F2E9" stroke-width="2" transform="rotate(45 10 10)"/></svg>`;
  const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  return new kakao.maps.MarkerImage(url, new kakao.maps.Size(20, 20), { offset: new kakao.maps.Point(10, 10) });
}

function addPoint(kind, name, lat, lng, fly) {
  const id = 'p' + (counter++);
  const color = kind === 'origin' ? '#1476A6' : '#1E7A46';
  const latlng = new kakao.maps.LatLng(lat, lng);
  const marker = new kakao.maps.Marker({
    position: latlng,
    image: markerImage(color),
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
  const defaultName = kind === 'origin' ? '출발지 ' + (origins.length + 1) : '골프장 ' + (destinations.length + 1);
  const label = kind === 'origin' ? '출발지 이름을 입력하세요' : '골프장 이름을 입력하세요';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative; width:200px; padding:10px; background:#F4F2E9; border:1px solid rgba(20,35,26,0.32); box-shadow:0 4px 14px rgba(20,35,26,0.25); font-family:Pretendard,sans-serif;';
  wrap.addEventListener('click', (e) => e.stopPropagation());

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', '닫기');
  closeBtn.style.cssText = 'position:absolute; top:4px; right:6px; border:none; background:none; cursor:pointer; color:#5C6459; font-size:15px; line-height:1; padding:2px;';

  const labelEl = document.createElement('div');
  labelEl.textContent = label;
  labelEl.style.cssText = 'font-size:11px; font-weight:600; color:#14231A; margin:0 18px 6px 0;';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = defaultName;
  input.style.cssText = 'width:100%; box-sizing:border-box; padding:6px 8px; border:1px solid rgba(20,35,26,0.32); background:#fff; font-size:12px; margin-bottom:6px; font-family:inherit;';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = '이 위치에 추가';
  confirmBtn.style.cssText = 'width:100%; padding:6px 8px; border:1px solid #14231A; background:#14231A; color:#F4F2E9; font-size:11.5px; font-weight:600; cursor:pointer;';

  wrap.append(closeBtn, labelEl, input, confirmBtn);

  function confirm() {
    const name = input.value.trim() || defaultName;
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
}

kakao.maps.event.addListener(map, 'click', (mouseEvent) => {
  if (!addMode) return;
  openMapPopup(addMode, mouseEvent.latLng);
});

function renderSearchResults(kind, resultsEl, inputEl, hintEl, results) {
  resultsEl.innerHTML = results.map((r, i) => `
    <div class="search-result-item" data-idx="${i}">
      <div class="search-result-name">${escapeHtml(r.place_name)}</div>
      <div class="search-result-addr">${escapeHtml(r.road_address_name || r.address_name || '')}</div>
    </div>
  `).join('');
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
originAddrInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitOriginAddr(); });
destAddrInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitDestAddr(); });
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

  resultArea.innerHTML = sorted.map((row, i) => {
    const metricVal = sortKey === 'fair' ? row.spread : sortKey === 'avg' ? row.avg : row.max;
    const distSpans = row.dists.map(d => `<span>${escapeHtml(d.name)} <b>${d.km.toFixed(1)}km</b></span>`).join('');
    return `<div class="result-card">
      <div class="result-rank mono">${i+1}</div>
      <div class="result-body">
        <div class="result-name">${escapeHtml(row.dest.name)}</div>
        <div class="result-dists">${distSpans}</div>
        <span class="result-metric">${metricLabel} ${metricVal.toFixed(1)}km</span>
      </div>
    </div>`;
  }).join('');
}

renderChips();
renderResults();
