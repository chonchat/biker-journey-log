// นำเข้า Supabase Client SDK (v2) ผ่าน CDN แบบ ES6 Module
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ============================================================
// 1. ตั้งค่าการเชื่อมต่อ Supabase
// ============================================================
const SUPABASE_URL = 'https://yduddaoltelgtqowvzlx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_I_rmkEBVoKKUUIxB_oWtnA_UXeHJChy';
const STORAGE_BUCKET = 'biker-gallery';
const DEFAULT_TRIP_IMAGE =
  'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?q=80&w=800&auto=format&fit=crop';

const cleanSupabaseUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const supabase = createClient(cleanSupabaseUrl, SUPABASE_ANON_KEY);

// ============================================================
// 2. ข้อมูลทริปตัวอย่างเริ่มต้นบนแผนที่ (พร้อมโปรไฟล์ สังเขป และลิงก์ผู้โพสต์)
// ============================================================
const showcaseTrips = [];

// ============================================================
// 3. State & Initialize Google Maps / Leaflet Map
// ============================================================
let currentUser = null;
let currentUserProfile = null;
let userTrips = [];
let activeModalTrip = null;
let isPickingMapCoord = false;
let tempPickMarker = null;
let searchPinMarker = null;
let userLocationMarker = null;
let userAccuracyCircle = null;

// การตั้งค่าแอปพลิเคชัน
const SETTINGS_STORAGE_KEY = 'biker_journey_settings_v1';
const PROFILE_EXTRA_STORAGE_KEY = 'biker_journey_profile_extra_v1';
const OWNER_CONTACT_STORAGE_KEY = 'biker_journey_owner_contact_v1';
const FEEDBACK_STORAGE_KEY = 'biker_journey_feedback_v1';

let appSettings = {
  mapStyle: 'googleStreets',
  showDemoTrips: false,
  showRoutes: true,
  quickMapClick: true,
};

try {
  const savedSettings = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || 'null');
  if (savedSettings) appSettings = { ...appSettings, ...savedSettings };
} catch {
  // ignore
}

const L = window.L;
const map = L.map('map', {
  zoomControl: false,
}).setView([15.87, 100.9925], 6);

L.control.zoom({ position: 'bottomright' }).addTo(map);

const mapTileLayers = {
  googleStreets: L.tileLayer('https://mt1.google.com/vt/lyrs=m&hl=th&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google Maps',
    maxZoom: 20,
  }),
  googleTerrain: L.tileLayer('https://mt1.google.com/vt/lyrs=p&hl=th&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google Maps Terrain',
    maxZoom: 20,
  }),
  googleHybrid: L.tileLayer('https://mt1.google.com/vt/lyrs=y&hl=th&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google Maps Satellite',
    maxZoom: 20,
  }),
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }),
  dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  }),
};

let activeTileLayer = mapTileLayers[appSettings.mapStyle] || mapTileLayers.googleStreets;
activeTileLayer.addTo(map);

function switchBaseMapStyle(styleKey) {
  const nextLayer = mapTileLayers[styleKey] || mapTileLayers.googleStreets;
  if (activeTileLayer && map.hasLayer(activeTileLayer)) {
    map.removeLayer(activeTileLayer);
  }
  activeTileLayer = nextLayer;
  activeTileLayer.addTo(map);
  appSettings.mapStyle = styleKey;
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(appSettings));
}

L.control
  .layers(
    {
      '🗺️ Google Maps (แผนที่ถนน)': mapTileLayers.googleStreets,
      '🏔️ Google Terrain (แผนที่ภูเขา)': mapTileLayers.googleTerrain,
      '🛰️ Google Satellite (ดาวเทียม+ชื่อถนน)': mapTileLayers.googleHybrid,
      '🌍 OpenStreetMap': mapTileLayers.osm,
      '🌙 Dark Mode Map': mapTileLayers.dark,
    },
    null,
    { position: 'bottomleft' }
  )
  .addTo(map);

setTimeout(() => map.invalidateSize(), 100);
setTimeout(() => map.invalidateSize(), 500);
window.addEventListener('resize', () => map.invalidateSize());

const markersLayer = L.layerGroup().addTo(map);
const routesLayer = L.layerGroup().addTo(map);

// ============================================================
// 4. DOM Elements
// ============================================================
const toastBox = document.getElementById('toastBox');
const pickMapBanner = document.getElementById('pickMapBanner');
const btnCancelPickMap = document.getElementById('btnCancelPickMap');
const btnResetMapView = document.getElementById('btnResetMapView');
const btnOpenLogTrip = document.getElementById('btnOpenLogTrip');
const btnMobileLogTrip = document.getElementById('btnMobileLogTrip');
const btnOpenGarage = document.getElementById('btnOpenGarage');
const navGarageLabel = document.getElementById('navGarageLabel');

// Sidebar Elements
const btnOpenSidebar = document.getElementById('btnOpenSidebar');
const btnCloseSidebar = document.getElementById('btnCloseSidebar');
const sidebarWrapper = document.getElementById('sidebarWrapper');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const sidebarPanel = document.getElementById('sidebarPanel');
const sideTabProfileBtn = document.getElementById('sideTabProfileBtn');
const sideTabSettingsBtn = document.getElementById('sideTabSettingsBtn');
const sideTabFeedbackBtn = document.getElementById('sideTabFeedbackBtn');
const sideSectionProfile = document.getElementById('sideSectionProfile');
const sideSectionSettings = document.getElementById('sideSectionSettings');
const sideSectionFeedback = document.getElementById('sideSectionFeedback');

// Sidebar Profile Edit Elements
const sideProfileGuestNotice = document.getElementById('sideProfileGuestNotice');
const sideProfileLoggedInContent = document.getElementById('sideProfileLoggedInContent');
const sideProfileCardHeader = document.getElementById('sideProfileCardHeader');
const btnSideLoginPrompt = document.getElementById('btnSideLoginPrompt');
const btnSideGoogleLogin = document.getElementById('btnSideGoogleLogin');
const btnSideLogout = document.getElementById('btnSideLogout');
const sideProfileAvatarPreview = document.getElementById('sideProfileAvatarPreview');
const sideProfileAvatarInitials = document.getElementById('sideProfileAvatarInitials');
const sideProfileAvatarImg = document.getElementById('sideProfileAvatarImg');
const sideProfileDisplayName = document.getElementById('sideProfileDisplayName');
const sideProfileDisplayBike = document.getElementById('sideProfileDisplayBike');
const sideProfileEmailDisplay = document.getElementById('sideProfileEmailDisplay');
const sideProfileDisplayStatus = document.getElementById('sideProfileDisplayStatus');
const formEditProfileSidebar = document.getElementById('formEditProfileSidebar');
const sideAvatarPreviewContainer = document.getElementById('sideAvatarPreviewContainer');
const sideAvatarFallbackIcon = document.getElementById('sideAvatarFallbackIcon');
const sideAvatarPreviewImg = document.getElementById('sideAvatarPreviewImg');
const inputProfileAvatarFile = document.getElementById('inputProfileAvatarFile');
const btnRemoveAvatar = document.getElementById('btnRemoveAvatar');
const lblChooseAvatar = document.getElementById('lblChooseAvatar');
const sideInputUsername = document.getElementById('sideInputUsername');
const sideInputBike = document.getElementById('sideInputBike');
const sideProfileLinksList = document.getElementById('sideProfileLinksList');
const sideNewLinkLabel = document.getElementById('sideNewLinkLabel');
const sideNewLinkUrl = document.getElementById('sideNewLinkUrl');
const btnAddProfileLink = document.getElementById('btnAddProfileLink');
const btnSaveProfileSidebar = document.getElementById('btnSaveProfileSidebar');

// Sidebar Settings Elements
const settingMapStyle = document.getElementById('settingMapStyle');
const settingShowDemoTrips = document.getElementById('settingShowDemoTrips');
const settingShowRoutes = document.getElementById('settingShowRoutes');
const settingQuickMapClick = document.getElementById('settingQuickMapClick');
const btnSettingLocateNow = document.getElementById('btnSettingLocateNow');
const btnSettingResetThailand = document.getElementById('btnSettingResetThailand');

// Sidebar Feedback Elements
const formSidebarFeedback = document.getElementById('formSidebarFeedback');
const feedbackStarGroup = document.getElementById('feedbackStarGroup');
const feedbackRatingLabel = document.getElementById('feedbackRatingLabel');
const feedbackCategory = document.getElementById('feedbackCategory');
const feedbackMessage = document.getElementById('feedbackMessage');
const feedbackHistoryList = document.getElementById('feedbackHistoryList');

// Sidebar Bottom Owner Contact Elements
const btnToggleEditOwnerContact = document.getElementById('btnToggleEditOwnerContact');
const ownerContactDisplayBox = document.getElementById('ownerContactDisplayBox');
const ownerContactName = document.getElementById('ownerContactName');
const ownerContactBio = document.getElementById('ownerContactBio');
const ownerContactLinksContainer = document.getElementById('ownerContactLinksContainer');
const formEditOwnerContact = document.getElementById('formEditOwnerContact');
const inputOwnerName = document.getElementById('inputOwnerName');
const inputOwnerBio = document.getElementById('inputOwnerBio');
const ownerEditLinksList = document.getElementById('ownerEditLinksList');
const inputOwnerLinkLabel = document.getElementById('inputOwnerLinkLabel');
const inputOwnerLinkUrl = document.getElementById('inputOwnerLinkUrl');
const btnAddOwnerLink = document.getElementById('btnAddOwnerLink');
const btnCancelOwnerContact = document.getElementById('btnCancelOwnerContact');

// Top Map Search Bar Elements
const mapSearchForm = document.getElementById('mapSearchForm');
const mapSearchInput = document.getElementById('mapSearchInput');
const btnClearSearch = document.getElementById('btnClearSearch');
const mapSearchResults = document.getElementById('mapSearchResults');
const btnMyLocation = document.getElementById('btnMyLocation');
const myLocationIcon = document.getElementById('myLocationIcon');
const btnHeaderRefresh = document.getElementById('btnHeaderRefresh');
const iconHeaderRefresh = document.getElementById('iconHeaderRefresh');

// Pull-to-Refresh Elements
const pullToRefreshIndicator = document.getElementById('pullToRefreshIndicator');
const pullToRefreshIcon = document.getElementById('pullToRefreshIcon');
const pullToRefreshText = document.getElementById('pullToRefreshText');

// Notification Elements
const btnOpenNotifications = document.getElementById('btnOpenNotifications');
const notificationBadge = document.getElementById('notificationBadge');
const notificationDropdown = document.getElementById('notificationDropdown');
const notificationList = document.getElementById('notificationList');
const btnMarkAllNotificationsRead = document.getElementById('btnMarkAllNotificationsRead');

// Detail Modal Elements
const detailModal = document.getElementById('detailModal');
const detailModalBox = document.getElementById('detailModalBox');
const detailBackdrop = document.getElementById('detailBackdrop');
const btnCloseDetail = document.getElementById('btnCloseDetail');
const modalImageWrap = document.getElementById('modalImageWrap');
const modalImage = document.getElementById('modalImage');

// Image Lightbox Viewer Elements
const imageLightboxModal = document.getElementById('imageLightboxModal');
const btnLightboxClose = document.getElementById('btnLightboxClose');
const lightboxPhotoIndex = document.getElementById('lightboxPhotoIndex');
const lightboxPhotoTitle = document.getElementById('lightboxPhotoTitle');
const lightboxViewOriginal = document.getElementById('lightboxViewOriginal');
const btnLightboxDeletePhoto = document.getElementById('btnLightboxDeletePhoto');
const btnLightboxPrev = document.getElementById('btnLightboxPrev');
const btnLightboxNext = document.getElementById('btnLightboxNext');
const lightboxImageContainer = document.getElementById('lightboxImageContainer');
const lightboxMainImage = document.getElementById('lightboxMainImage');
const lightboxThumbsStrip = document.getElementById('lightboxThumbsStrip');
const modalDate = document.getElementById('modalDate');
const modalTitle = document.getElementById('modalTitle');
const modalAuthorAvatar = document.getElementById('modalAuthorAvatar');
const modalAuthorAvatarInitials = document.getElementById('modalAuthorAvatarInitials');
const modalAuthorAvatarImg = document.getElementById('modalAuthorAvatarImg');
const modalAuthorName = document.getElementById('modalAuthorName');
const modalAuthorBike = document.getElementById('modalAuthorBike');
const modalAuthorLinks = document.getElementById('modalAuthorLinks');
const btnLikeTrip = document.getElementById('btnLikeTrip');
const btnDislikeTrip = document.getElementById('btnDislikeTrip');
const iconLikeTrip = document.getElementById('iconLikeTrip');
const iconDislikeTrip = document.getElementById('iconDislikeTrip');
const likeCount = document.getElementById('likeCount');
const dislikeCount = document.getElementById('dislikeCount');
const commentCount = document.getElementById('commentCount');
const formAddComment = document.getElementById('formAddComment');
const inputCommentText = document.getElementById('inputCommentText');
const btnSubmitComment = document.getElementById('btnSubmitComment');
const modalCommentsList = document.getElementById('modalCommentsList');
const modalCoords = document.getElementById('modalCoords');
const modalDesc = document.getElementById('modalDesc');
const modalGallery = document.getElementById('modalGallery');
const modalCheckpoints = document.getElementById('modalCheckpoints');
const btnEditTripModal = document.getElementById('btnEditTripModal');
const btnDeleteTripModal = document.getElementById('btnDeleteTripModal');
const labelAddMorePhoto = document.getElementById('labelAddMorePhoto');
const inputAddMorePhoto = document.getElementById('inputAddMorePhoto');
const btnToggleAddCp = document.getElementById('btnToggleAddCp');
const formAddCheckpoint = document.getElementById('formAddCheckpoint');
const cpLocationName = document.getElementById('cpLocationName');
const btnCpSearchPlace = document.getElementById('btnCpSearchPlace');
const cpLat = document.getElementById('cpLat');
const cpLng = document.getElementById('cpLng');
const btnCpGetGps = document.getElementById('btnCpGetGps');
const btnCpSubmit = document.getElementById('btnCpSubmit');

// Edit Trip Modal Elements
const editTripModal = document.getElementById('editTripModal');
const editTripBackdrop = document.getElementById('editTripBackdrop');
const btnCloseEditTrip = document.getElementById('btnCloseEditTrip');
const formEditTrip = document.getElementById('formEditTrip');
const editTripId = document.getElementById('editTripId');
const editTripTitle = document.getElementById('editTripTitle');
const editTripDate = document.getElementById('editTripDate');
const editTripDesc = document.getElementById('editTripDesc');
const editTripPhotoFile = document.getElementById('editTripPhotoFile');
const editTripPhotoPreview = document.getElementById('editTripPhotoPreview');
const editTripPhotoFilename = document.getElementById('editTripPhotoFilename');
const editTripPhotoCountBadge = document.getElementById('editTripPhotoCountBadge');
const editTripPhotoPreviewsList = document.getElementById('editTripPhotoPreviewsList');
const editTripExistingPhotosContainer = document.getElementById('editTripExistingPhotosContainer');
const editTripExistingPhotosList = document.getElementById('editTripExistingPhotosList');
const editTripExistingCountBadge = document.getElementById('editTripExistingCountBadge');
const btnSubmitEditTrip = document.getElementById('btnSubmitEditTrip');
const btnCancelEditTrip = document.getElementById('btnCancelEditTrip');

// Log Trip Modal Elements
const logTripModal = document.getElementById('logTripModal');
const logTripBackdrop = document.getElementById('logTripBackdrop');
const btnCloseLogTrip = document.getElementById('btnCloseLogTrip');
const formLogTrip = document.getElementById('formLogTrip');
const tripTitle = document.getElementById('tripTitle');
const tripDate = document.getElementById('tripDate');
const tripLocationName = document.getElementById('tripLocationName');
const btnModalSearchPlace = document.getElementById('btnModalSearchPlace');
const modalPlaceSearchResults = document.getElementById('modalPlaceSearchResults');
const tripLat = document.getElementById('tripLat');
const tripLng = document.getElementById('tripLng');
const tripDesc = document.getElementById('tripDesc');
const tripPhotoFile = document.getElementById('tripPhotoFile');
const tripPhotoIcon = document.getElementById('tripPhotoIcon');
const tripPhotoFilename = document.getElementById('tripPhotoFilename');
const tripPhotoCountBadge = document.getElementById('tripPhotoCountBadge');
const tripPhotoPreviewsList = document.getElementById('tripPhotoPreviewsList');
const btnTripUseGps = document.getElementById('btnTripUseGps');
const btnTripPickOnMap = document.getElementById('btnTripPickOnMap');
const btnSubmitLogTrip = document.getElementById('btnSubmitLogTrip');

// Garage & Auth Modal Elements
const garageModal = document.getElementById('garageModal');
const garageBackdrop = document.getElementById('garageBackdrop');
const btnCloseGarage = document.getElementById('btnCloseGarage');
const authContainer = document.getElementById('authContainer');
const garageProfileContainer = document.getElementById('garageProfileContainer');
const tabLoginBtn = document.getElementById('tabLoginBtn');
const tabRegisterBtn = document.getElementById('tabRegisterBtn');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const btnLoginSubmit = document.getElementById('btnLoginSubmit');
const btnRegSubmit = document.getElementById('btnRegSubmit');
const garageAvatarPreview = document.getElementById('garageAvatarPreview');
const garageAvatarInitials = document.getElementById('garageAvatarInitials');
const garageAvatarImg = document.getElementById('garageAvatarImg');
const garageUsername = document.getElementById('garageUsername');
const garageBikeModel = document.getElementById('garageBikeModel');
const garageEmail = document.getElementById('garageEmail');
const garageProfileLinks = document.getElementById('garageProfileLinks');
const btnGarageOpenEditProfile = document.getElementById('btnGarageOpenEditProfile');
const garageTripCount = document.getElementById('garageTripCount');
const garageTripsList = document.getElementById('garageTripsList');
const btnLogout = document.getElementById('btnLogout');
const btnGarageNewTrip = document.getElementById('btnGarageNewTrip');
const btnGoogleSignIn = document.getElementById('btnGoogleSignIn');
const googleSetupNotice = document.getElementById('googleSetupNotice');

// Directions Panel Elements (Google Maps Style Routing)
const btnToggleDirectionsPanel = document.getElementById('btnToggleDirectionsPanel');
const directionsCard = document.getElementById('directionsCard');
const btnCloseDirectionsCard = document.getElementById('btnCloseDirectionsCard');
const routeInputStart = document.getElementById('routeInputStart');
const btnRouteUseCurrentGps = document.getElementById('btnRouteUseCurrentGps');
const routeStartSuggest = document.getElementById('routeStartSuggest');
const routeWaypointsContainer = document.getElementById('routeWaypointsContainer');
const routeInputEnd = document.getElementById('routeInputEnd');
const btnRouteSwapPoints = document.getElementById('btnRouteSwapPoints');
const routeEndSuggest = document.getElementById('routeEndSuggest');
const btnAddRouteWaypoint = document.getElementById('btnAddRouteWaypoint');
const btnCalculateRoute = document.getElementById('btnCalculateRoute');
const routeSummaryBox = document.getElementById('routeSummaryBox');
const routeDurationText = document.getElementById('routeDurationText');
const routeDistanceText = document.getElementById('routeDistanceText');
const routeViaRoadText = document.getElementById('routeViaRoadText');
const btnSaveRouteAsTrip = document.getElementById('btnSaveRouteAsTrip');
const btnClearActiveRoute = document.getElementById('btnClearActiveRoute');

// Layer สำหรับวาดเส้น Directions บนแผนที่
const activeDirectionsLayer = L.layerGroup().addTo(map);

// GPS Permission & Banner Elements
const gpsPermissionBanner = document.getElementById('gpsPermissionBanner');
const btnBannerAllowGps = document.getElementById('btnBannerAllowGps');
const btnBannerDismissGps = document.getElementById('btnBannerDismissGps');

const sideGpsStatusBadge = document.getElementById('sideGpsStatusBadge');
const btnSideOpenGpsModal = document.getElementById('btnSideOpenGpsModal');
const btnSideGpsTroubleshoot = document.getElementById('btnSideGpsTroubleshoot');

const gpsPermissionModal = document.getElementById('gpsPermissionModal');
const gpsPermissionBackdrop = document.getElementById('gpsPermissionBackdrop');
const btnCloseGpsModal = document.getElementById('btnCloseGpsModal');
const modalGpsStatusPill = document.getElementById('modalGpsStatusPill');
const btnGpsModalAllow = document.getElementById('btnGpsModalAllow');
const btnGpsModalDismiss = document.getElementById('btnGpsModalDismiss');
const btnToggleGpsTroubleshoot = document.getElementById('btnToggleGpsTroubleshoot');
const gpsTroubleshootChevron = document.getElementById('gpsTroubleshootChevron');
const gpsTroubleshootContent = document.getElementById('gpsTroubleshootContent');

if (tripDate) {
  tripDate.valueAsDate = new Date();
}

// ============================================================
// 4.2 ระบบแถบด้านข้าง (Sidebar Drawer: โปรไฟล์ / ตั้งค่า / ข้อเสนอแนะ / ติดต่อผู้พัฒนา)
// ============================================================
function openSidebar(tab = 'profile') {
  switchSidebarTab(tab);
  sidebarWrapper.classList.remove('hidden');
  setTimeout(() => {
    sidebarPanel.classList.remove('-translate-x-full');
    sidebarPanel.classList.add('translate-x-0');
  }, 10);
}

function closeSidebar() {
  sidebarPanel.classList.remove('translate-x-0');
  sidebarPanel.classList.add('-translate-x-full');
  setTimeout(() => {
    sidebarWrapper.classList.add('hidden');
  }, 280);
}

function switchSidebarTab(tab) {
  const activeClass =
    'py-1.5 text-xs font-bold rounded-lg bg-brand-500 text-zinc-950 flex items-center justify-center gap-1 transition';
  const idleClass =
    'py-1.5 text-xs font-bold rounded-lg text-zinc-400 hover:text-white flex items-center justify-center gap-1 transition';

  sideTabProfileBtn.className = tab === 'profile' ? activeClass : idleClass;
  sideTabSettingsBtn.className = tab === 'settings' ? activeClass : idleClass;
  sideTabFeedbackBtn.className = tab === 'feedback' ? activeClass : idleClass;

  sideSectionProfile.classList.toggle('hidden', tab !== 'profile');
  sideSectionSettings.classList.toggle('hidden', tab !== 'settings');
  sideSectionFeedback.classList.toggle('hidden', tab !== 'feedback');
}

btnOpenSidebar.addEventListener('click', () => openSidebar('profile'));
btnCloseSidebar.addEventListener('click', closeSidebar);
sidebarBackdrop.addEventListener('click', closeSidebar);
sideTabProfileBtn.addEventListener('click', () => switchSidebarTab('profile'));
sideTabSettingsBtn.addEventListener('click', () => switchSidebarTab('settings'));
sideTabFeedbackBtn.addEventListener('click', () => switchSidebarTab('feedback'));

if (btnSideLoginPrompt) {
  btnSideLoginPrompt.addEventListener('click', () => {
    closeSidebar();
    openGarageModal();
  });
}

if (btnSideLogout) {
  btnSideLogout.addEventListener('click', async () => {
    await supabase.auth.signOut();
    showToast('ออกจากระบบเรียบร้อยแล้ว');
  });
}

if (btnGarageOpenEditProfile) {
  btnGarageOpenEditProfile.addEventListener('click', () => {
    closeGarageModal();
    openSidebar('profile');
  });
}

// Helper สร้างป้ายลิงก์ที่คลิกเปิดได้ (ใช้ทั้งในหน้าติดต่อผู้พัฒนา, หน้าโปรไฟล์ Garage, และการ์ดผู้โพสต์ทริป)
function renderClickableLinksPills(containerEl, linksArray) {
  if (!containerEl) return;
  containerEl.innerHTML = '';
  const list = Array.isArray(linksArray) ? linksArray : [];

  list.forEach((linkObj) => {
    if (!linkObj || !linkObj.url) return;
    const a = document.createElement('a');
    a.href = linkObj.url.startsWith('http') ? linkObj.url : `https://${linkObj.url}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className =
      'inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900 hover:bg-brand-500 text-brand-400 hover:text-zinc-950 border border-zinc-700 hover:border-brand-500 text-[11px] font-semibold transition';
    a.innerHTML = `<i class="ph-bold ph-arrow-square-out"></i> <span>${linkObj.label || 'ลิงก์'}</span>`;
    containerEl.appendChild(a);
  });
}

// ============================================================
// 4.3 ระบบแก้ไขโปรไฟล์นักบิด + สังเขป (Bio) + แนบลิงก์ในโปรไฟล์
// ============================================================
let editingProfileLinks = [];

function getLocalProfileExtra() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_EXTRA_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveLocalProfileExtra(data) {
  localStorage.setItem(PROFILE_EXTRA_STORAGE_KEY, JSON.stringify(data));
}

function renderSidebarEditingProfileLinks() {
  sideProfileLinksList.innerHTML = '';
  if (editingProfileLinks.length === 0) {
    sideProfileLinksList.innerHTML =
      '<div class="text-[11px] text-zinc-500 italic">ยังไม่มีลิงก์ที่แนบไว้ เพิ่มลิงก์ด้านล่างได้เลย</div>';
    return;
  }

  editingProfileLinks.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className =
      'flex items-center justify-between gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs';
    row.innerHTML = `
      <div class="truncate">
        <span class="font-bold text-brand-400">${item.label}:</span>
        <span class="text-zinc-400 text-[11px] ml-1">${item.url}</span>
      </div>
      <button type="button" class="text-zinc-500 hover:text-red-400 text-xs font-bold shrink-0">✕</button>
    `;
    row.querySelector('button').addEventListener('click', () => {
      editingProfileLinks.splice(idx, 1);
      renderSidebarEditingProfileLinks();
    });
    sideProfileLinksList.appendChild(row);
  });
}

btnAddProfileLink.addEventListener('click', () => {
  const label = sideNewLinkLabel.value.trim();
  let url = sideNewLinkUrl.value.trim();
  if (!label || !url) {
    showToast('กรุณากรอกทั้งชื่อลิงก์และ URL ก่อนกดเพิ่ม', 'error');
    return;
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  editingProfileLinks.push({ label, url });
  sideNewLinkLabel.value = '';
  sideNewLinkUrl.value = '';
  renderSidebarEditingProfileLinks();
});

// Helper จัดการแสดงผล Avatar (ถ้ามีรูปให้แสดง <img> ถ้าไม่มีให้แสดงตัวย่อ/ไอคอน)
function setAvatarDisplay(imgEl, initialsEl, avatarUrl, fallbackText = '🏍️') {
  if (avatarUrl) {
    if (imgEl) {
      imgEl.src = avatarUrl;
      imgEl.classList.remove('hidden');
    }
    if (initialsEl) {
      initialsEl.classList.add('hidden');
    }
  } else {
    if (imgEl) {
      imgEl.src = '';
      imgEl.classList.add('hidden');
    }
    if (initialsEl) {
      initialsEl.textContent = fallbackText;
      initialsEl.classList.remove('hidden');
    }
  }
}

let pendingAvatarDataUrl = null;

if (inputProfileAvatarFile) {
  inputProfileAvatarFile.addEventListener('change', async () => {
    const file = inputProfileAvatarFile.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file, 400, 0.88);
      pendingAvatarDataUrl = dataUrl;
      setAvatarDisplay(sideAvatarPreviewImg, sideAvatarFallbackIcon, dataUrl);
      if (btnRemoveAvatar) btnRemoveAvatar.classList.remove('hidden');
      if (lblChooseAvatar) lblChooseAvatar.textContent = 'เปลี่ยนรูปโปรไฟล์';
      showToast('เลือกรูปโปรไฟล์เรียบร้อย กด "บันทึกข้อมูลโปรไฟล์" ได้เลยครับ 📸');
    } catch {
      showToast('ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง', 'error');
    }
  });
}

if (btnRemoveAvatar) {
  btnRemoveAvatar.addEventListener('click', () => {
    pendingAvatarDataUrl = '';
    if (inputProfileAvatarFile) inputProfileAvatarFile.value = '';
    const initial = (sideInputUsername?.value || 'R').charAt(0).toUpperCase() || '🏍️';
    setAvatarDisplay(sideAvatarPreviewImg, sideAvatarFallbackIcon, '', initial);
    btnRemoveAvatar.classList.add('hidden');
    if (lblChooseAvatar) lblChooseAvatar.textContent = 'เลือกรูปโปรไฟล์';
    showToast('นำรูปโปรไฟล์ออกแล้ว กด "บันทึกข้อมูลโปรไฟล์" เพื่อยืนยัน');
  });
}

function populateProfileUIEverywhere() {
  const localExtra = getLocalProfileExtra();
  const username =
    currentUserProfile?.username ||
    localExtra.username ||
    currentUser?.email?.split('@')[0] ||
    'Rider';
  const bikeModel =
    currentUserProfile?.bike_model || localExtra.bike_model || 'Biker Motorcycle';
  const avatarUrl =
    currentUserProfile?.avatar_url ||
    localExtra.avatar_url ||
    currentUser?.user_metadata?.avatar_url ||
    currentUser?.user_metadata?.picture ||
    '';
  const links =
    Array.isArray(currentUserProfile?.social_links) && currentUserProfile.social_links.length > 0
      ? currentUserProfile.social_links
      : Array.isArray(localExtra.social_links)
      ? localExtra.social_links
      : [];

  const initialLetter = username.charAt(0).toUpperCase() || '🏍️';

  // อัปเดตสถานะการล็อกอินในแถบโปรไฟล์ด้านข้าง
  if (currentUser) {
    if (sideProfileGuestNotice) sideProfileGuestNotice.classList.add('hidden');
    if (sideProfileLoggedInContent) sideProfileLoggedInContent.classList.remove('hidden');
    if (btnSideLogout) btnSideLogout.classList.remove('hidden');
    if (sideProfileEmailDisplay) sideProfileEmailDisplay.textContent = currentUser.email || '';
  } else {
    if (sideProfileGuestNotice) sideProfileGuestNotice.classList.remove('hidden');
    if (sideProfileLoggedInContent) sideProfileLoggedInContent.classList.add('hidden');
    if (btnSideLogout) btnSideLogout.classList.add('hidden');
  }

  // อัปเดตรูปโปรไฟล์ใน Sidebar
  const currentPreviewAvatar = pendingAvatarDataUrl !== null ? pendingAvatarDataUrl : avatarUrl;
  setAvatarDisplay(sideProfileAvatarImg, sideProfileAvatarInitials, currentPreviewAvatar, initialLetter);
  setAvatarDisplay(sideAvatarPreviewImg, sideAvatarFallbackIcon, currentPreviewAvatar, initialLetter);
  if (btnRemoveAvatar) {
    btnRemoveAvatar.classList.toggle('hidden', !currentPreviewAvatar);
  }
  if (lblChooseAvatar) {
    lblChooseAvatar.textContent = currentPreviewAvatar ? 'เปลี่ยนรูปโปรไฟล์' : 'เลือกรูปโปรไฟล์';
  }

  sideProfileDisplayName.textContent = username;
  sideProfileDisplayBike.textContent = `🏍️ ${bikeModel}`;

  sideInputUsername.value = username;
  sideInputBike.value = bikeModel;
  editingProfileLinks = [...links];
  renderSidebarEditingProfileLinks();

  // อัปเดต Navbar & Garage Modal
  if (currentUser) {
    navGarageLabel.textContent = username;
    garageUsername.textContent = username;
    garageBikeModel.textContent = `🏍️ ${bikeModel}`;
    garageEmail.textContent = currentUser.email || '';
    setAvatarDisplay(garageAvatarImg, garageAvatarInitials, avatarUrl, initialLetter);
  }
  renderClickableLinksPills(garageProfileLinks, links);
}

formEditProfileSidebar.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) {
    showToast('กรุณาเข้าสู่ระบบก่อนแก้ไขโปรไฟล์', 'error');
    openGarageModal();
    return;
  }
  const newUsername = sideInputUsername.value.trim() || 'Rider';
  const newBike = sideInputBike.value.trim() || 'Biker Motorcycle';

  // หากผู้ใช้พิมพ์ลิงก์ค้างไว้ในช่องแล้วยังไม่ได้กดปุ่ม + ให้เพิ่มเข้าอาร์เรย์อัตโนมัติ
  if (sideNewLinkLabel.value.trim() && sideNewLinkUrl.value.trim()) {
    let rawUrl = sideNewLinkUrl.value.trim();
    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      rawUrl = `https://${rawUrl}`;
    }
    editingProfileLinks.push({ label: sideNewLinkLabel.value.trim(), url: rawUrl });
    sideNewLinkLabel.value = '';
    sideNewLinkUrl.value = '';
  }

  btnSaveProfileSidebar.disabled = true;
  btnSaveProfileSidebar.textContent = 'กำลังบันทึกโปรไฟล์...';

  try {
    const localExtra = getLocalProfileExtra();
    let finalAvatarUrl = pendingAvatarDataUrl !== null
      ? pendingAvatarDataUrl
      : (currentUserProfile?.avatar_url || localExtra.avatar_url || '');

    // อัปโหลดรูปไปยัง Supabase Storage หากเป็นไฟล์ใหม่
    const avatarFile = inputProfileAvatarFile?.files?.[0];
    if (avatarFile && currentUser) {
      try {
        const ext = avatarFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const avatarPath = `${currentUser.id}/avatar/profile_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(avatarPath, avatarFile, { upsert: true });
        if (!upErr) {
          const { data: pubData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(avatarPath);
          if (pubData?.publicUrl) {
            finalAvatarUrl = pubData.publicUrl;
          }
        }
      } catch (e) {
        console.warn('Avatar storage upload notice, using compressed data URL:', e);
      }
    }

    saveLocalProfileExtra({
      username: newUsername,
      bike_model: newBike,
      avatar_url: finalAvatarUrl,
      social_links: editingProfileLinks,
    });

    if (currentUser) {
      await supabase.auth.updateUser({
        data: {
          username: newUsername,
          bike_model: newBike,
          avatar_url: finalAvatarUrl,
          social_links: editingProfileLinks,
        },
      });

      // อัปเดตตาราง profiles
      const { error: fullUpsertErr } = await supabase.from('profiles').upsert({
        id: currentUser.id,
        username: newUsername,
        bike_model: newBike,
        avatar_url: finalAvatarUrl,
        social_links: editingProfileLinks,
      });

      if (fullUpsertErr) {
        await supabase.from('profiles').upsert({
          id: currentUser.id,
          username: newUsername,
          bike_model: newBike,
          avatar_url: finalAvatarUrl,
        });
      }
    }

    currentUserProfile = {
      ...(currentUserProfile || {}),
      username: newUsername,
      bike_model: newBike,
      avatar_url: finalAvatarUrl,
      social_links: [...editingProfileLinks],
    };

    pendingAvatarDataUrl = null;
    if (inputProfileAvatarFile) inputProfileAvatarFile.value = '';

    populateProfileUIEverywhere();
    await fetchSupabaseTrips();
    showToast('บันทึกรูปโปรไฟล์และข้อมูลเรียบร้อยแล้ว! ✨');
  } catch (err) {
    showToast(`บันทึกโปรไฟล์ไม่สำเร็จ: ${err.message}`, 'error');
  } finally {
    btnSaveProfileSidebar.disabled = false;
    btnSaveProfileSidebar.innerHTML =
      '<i class="ph-bold ph-floppy-disk text-base"></i> บันทึกข้อมูลโปรไฟล์';
  }
});

// ============================================================
// 4.4 ระบบตั้งค่า (Settings) และข้อเสนอแนะ (Feedback) และส่วนติดต่อล่างสุด (Owner Contact)
// ============================================================
function initSidebarSettingsUI() {
  settingMapStyle.value = appSettings.mapStyle || 'googleStreets';
  settingShowDemoTrips.checked = appSettings.showDemoTrips !== false;
  settingShowRoutes.checked = appSettings.showRoutes !== false;
  settingQuickMapClick.checked = appSettings.quickMapClick !== false;

  settingMapStyle.addEventListener('change', () => {
    switchBaseMapStyle(settingMapStyle.value);
    showToast('เปลี่ยนรูปแบบแผนที่เรียบร้อยแล้ว');
  });

  settingShowDemoTrips.addEventListener('change', () => {
    appSettings.showDemoTrips = settingShowDemoTrips.checked;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(appSettings));
    renderMapMarkers();
  });

  settingShowRoutes.addEventListener('change', () => {
    appSettings.showRoutes = settingShowRoutes.checked;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(appSettings));
    renderMapMarkers();
  });

  settingQuickMapClick.addEventListener('change', () => {
    appSettings.quickMapClick = settingQuickMapClick.checked;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(appSettings));
  });

  btnSettingLocateNow.addEventListener('click', () => {
    closeSidebar();
    locateMeOnMap();
  });

  btnSettingResetThailand.addEventListener('click', () => {
    closeSidebar();
    map.flyTo([15.87, 100.9925], 6, { duration: 1 });
  });
}

// ระบบข้อเสนอแนะ (Feedback)
let selectedFeedbackStars = 5;
function initSidebarFeedbackUI() {
  const starBtns = feedbackStarGroup.querySelectorAll('.star-btn');

  function updateStarsVisual(rating) {
    selectedFeedbackStars = rating;
    feedbackRatingLabel.textContent = `${rating} / 5 ดาว`;
    starBtns.forEach((btn) => {
      const val = Number(btn.getAttribute('data-star'));
      btn.className =
        val <= rating
          ? 'star-btn text-brand-500 hover:scale-110 transition'
          : 'star-btn text-zinc-700 hover:scale-110 transition';
    });
  }

  starBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      updateStarsVisual(Number(btn.getAttribute('data-star')));
    });
  });

  renderFeedbackHistory();

  formSidebarFeedback.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = feedbackMessage.value.trim();
    if (!msg) return;

    const list = getFeedbackList();
    list.unshift({
      id: `fb-${Date.now()}`,
      stars: selectedFeedbackStars,
      category: feedbackCategory.value,
      message: msg,
      author: currentUserProfile?.username || 'Rider',
      date: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }),
    });
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(list));
    feedbackMessage.value = '';
    renderFeedbackHistory();
    showToast('ขอบคุณสำหรับข้อเสนอแนะของคุณครับ! 🙏');
  });
}

function getFeedbackList() {
  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function renderFeedbackHistory() {
  const list = getFeedbackList();
  feedbackHistoryList.innerHTML = '';

  if (list.length === 0) {
    feedbackHistoryList.innerHTML =
      '<div class="text-xs text-zinc-500 bg-zinc-950 border border-zinc-800/80 rounded-xl p-3 text-center">ยังไม่มีรายการข้อเสนอแนะ ส่งข้อเสนอแนะแรกของคุณได้เลย!</div>';
    return;
  }

  list.forEach((fb) => {
    const card = document.createElement('div');
    card.className = 'bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs space-y-1';
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="font-bold text-brand-400">${fb.category}</span>
        <span class="text-amber-400">${'★'.repeat(fb.stars)}${'☆'.repeat(5 - fb.stars)}</span>
      </div>
      <p class="text-zinc-300">${fb.message}</p>
      <div class="text-[10px] text-zinc-500 flex justify-between">
        <span>โดย ${fb.author}</span>
        <span>${fb.date}</span>
      </div>
    `;
    feedbackHistoryList.appendChild(card);
  });
}

// ระบบส่วนติดต่อของฉันไว้ล่างสุดของแถบด้านข้าง (Owner Contact Footer + แนบลิงก์ได้)
const defaultOwnerContact = {
  name: 'ติดต่อผู้พัฒนา (My Contact)',
  bio: 'พูดคุยเรื่องทริปมอเตอร์ไซค์ หรือติดต่อผ่านลิงก์ด้านล่างได้เลยครับ 🏍️',
  links: [
    { label: 'Facebook', url: 'https://facebook.com' },
    { label: 'Instagram', url: 'https://instagram.com' },
    { label: 'GitHub', url: 'https://github.com' },
  ],
};

let ownerContactState = defaultOwnerContact;
try {
  const savedOwner = JSON.parse(localStorage.getItem(OWNER_CONTACT_STORAGE_KEY) || 'null');
  if (savedOwner && savedOwner.name) {
    ownerContactState = savedOwner;
  }
} catch {
  // use default
}

let tempOwnerLinks = [...(ownerContactState.links || [])];

function renderOwnerContactFooter() {
  ownerContactName.textContent = ownerContactState.name;
  ownerContactBio.textContent = ownerContactState.bio;
  renderClickableLinksPills(ownerContactLinksContainer, ownerContactState.links || []);
}

function renderOwnerEditLinksList() {
  ownerEditLinksList.innerHTML = '';
  tempOwnerLinks.forEach((lk, index) => {
    const row = document.createElement('div');
    row.className =
      'flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[11px]';
    row.innerHTML = `
      <span class="truncate text-zinc-300"><strong class="text-brand-400">${lk.label}:</strong> ${lk.url}</span>
      <button type="button" class="text-zinc-500 hover:text-red-400 ml-2 font-bold">✕</button>
    `;
    row.querySelector('button').addEventListener('click', () => {
      tempOwnerLinks.splice(index, 1);
      renderOwnerEditLinksList();
    });
    ownerEditLinksList.appendChild(row);
  });
}

btnToggleEditOwnerContact.addEventListener('click', () => {
  const isHidden = formEditOwnerContact.classList.contains('hidden');
  if (isHidden) {
    inputOwnerName.value = ownerContactState.name;
    inputOwnerBio.value = ownerContactState.bio;
    tempOwnerLinks = [...(ownerContactState.links || [])];
    renderOwnerEditLinksList();
    formEditOwnerContact.classList.remove('hidden');
  } else {
    formEditOwnerContact.classList.add('hidden');
  }
});

btnCancelOwnerContact.addEventListener('click', () => {
  formEditOwnerContact.classList.add('hidden');
});

btnAddOwnerLink.addEventListener('click', () => {
  const label = inputOwnerLinkLabel.value.trim();
  let url = inputOwnerLinkUrl.value.trim();
  if (!label || !url) {
    showToast('กรุณาใส่ชื่อปุ่มและลิงก์ URL ก่อนกด +', 'error');
    return;
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  tempOwnerLinks.push({ label, url });
  inputOwnerLinkLabel.value = '';
  inputOwnerLinkUrl.value = '';
  renderOwnerEditLinksList();
});

formEditOwnerContact.addEventListener('submit', (e) => {
  e.preventDefault();
  if (inputOwnerLinkLabel.value.trim() && inputOwnerLinkUrl.value.trim()) {
    let rawUrl = inputOwnerLinkUrl.value.trim();
    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      rawUrl = `https://${rawUrl}`;
    }
    tempOwnerLinks.push({ label: inputOwnerLinkLabel.value.trim(), url: rawUrl });
    inputOwnerLinkLabel.value = '';
    inputOwnerLinkUrl.value = '';
  }

  ownerContactState = {
    name: inputOwnerName.value.trim() || 'ติดต่อผู้พัฒนา',
    bio: inputOwnerBio.value.trim() || '',
    links: [...tempOwnerLinks],
  };

  localStorage.setItem(OWNER_CONTACT_STORAGE_KEY, JSON.stringify(ownerContactState));
  renderOwnerContactFooter();
  formEditOwnerContact.classList.add('hidden');
  showToast('บันทึกข้อมูลติดต่อและลิงก์ด้านล่างเรียบร้อยแล้ว!');
});

// ============================================================
// 4.5 ระบบขออนุญาตเปิดใช้งาน GPS และตรวจสอบสิทธิ์ (GPS Permission Manager)
// ============================================================
function updateGpsStatusUI(state) {
  // state: 'granted', 'prompt', 'denied', 'unsupported', 'unknown'
  const configs = {
    granted: {
      text: '🟢 อนุญาตแล้ว (Active)',
      badgeClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
      pillClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
    },
    prompt: {
      text: '🟡 รอการอนุญาต (Prompt)',
      badgeClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/40',
      pillClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/40',
    },
    denied: {
      text: '🔴 ถูกปฏิเสธ / บล็อก (Denied)',
      badgeClass: 'bg-red-500/20 text-red-400 border border-red-500/40',
      pillClass: 'bg-red-500/20 text-red-400 border border-red-500/40',
    },
    unsupported: {
      text: '⚪ เบราว์เซอร์ไม่รองรับ GPS',
      badgeClass: 'bg-zinc-800 text-zinc-500 border border-zinc-700',
      pillClass: 'bg-zinc-800 text-zinc-500 border border-zinc-700',
    },
    unknown: {
      text: '⚪ ตรวจสอบการอนุญาต',
      badgeClass: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
      pillClass: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
    },
  };

  const cfg = configs[state] || configs.unknown;
  if (sideGpsStatusBadge) {
    sideGpsStatusBadge.textContent = cfg.text;
    sideGpsStatusBadge.className = `text-[10px] px-2 py-0.5 rounded-full font-semibold ${cfg.badgeClass}`;
  }
  if (modalGpsStatusPill) {
    modalGpsStatusPill.textContent = cfg.text;
    modalGpsStatusPill.className = `text-[10px] px-2 py-0.5 rounded-full font-semibold ${cfg.pillClass}`;
  }
}

async function checkGpsPermission() {
  if (!navigator.geolocation) {
    updateGpsStatusUI('unsupported');
    return 'unsupported';
  }
  if (!navigator.permissions || !navigator.permissions.query) {
    updateGpsStatusUI('unknown');
    return 'unknown';
  }
  try {
    const perm = await navigator.permissions.query({ name: 'geolocation' });
    updateGpsStatusUI(perm.state);
    perm.onchange = () => {
      updateGpsStatusUI(perm.state);
      if (perm.state === 'granted' && gpsPermissionBanner) {
        gpsPermissionBanner.classList.add('hidden');
      }
    };
    return perm.state;
  } catch (err) {
    updateGpsStatusUI('unknown');
    return 'unknown';
  }
}

function openGpsPermissionModal(expandTroubleshoot = false) {
  if (!gpsPermissionModal) return;
  gpsPermissionModal.classList.remove('hidden');
  checkGpsPermission();

  if (expandTroubleshoot) {
    if (gpsTroubleshootContent) gpsTroubleshootContent.classList.remove('hidden');
    if (gpsTroubleshootChevron) gpsTroubleshootChevron.classList.add('rotate-180');
  }
}

function closeGpsPermissionModal() {
  if (!gpsPermissionModal) return;
  gpsPermissionModal.classList.add('hidden');
}

// ผูก Event Listeners สำหรับ GPS Permission Modal และ Banner
if (btnCloseGpsModal) {
  btnCloseGpsModal.addEventListener('click', closeGpsPermissionModal);
}
if (gpsPermissionBackdrop) {
  gpsPermissionBackdrop.addEventListener('click', closeGpsPermissionModal);
}
if (btnGpsModalDismiss) {
  btnGpsModalDismiss.addEventListener('click', () => {
    closeGpsPermissionModal();
    if (gpsPermissionBanner) gpsPermissionBanner.classList.add('hidden');
    localStorage.setItem('biker_gps_banner_dismissed', 'true');
  });
}
if (btnGpsModalAllow) {
  btnGpsModalAllow.addEventListener('click', () => {
    locateMeOnMap({ showModalOnDenied: true, autoCloseModal: true });
  });
}

if (btnToggleGpsTroubleshoot) {
  btnToggleGpsTroubleshoot.addEventListener('click', () => {
    if (gpsTroubleshootContent) gpsTroubleshootContent.classList.toggle('hidden');
    if (gpsTroubleshootChevron) gpsTroubleshootChevron.classList.toggle('rotate-180');
  });
}

// Banner buttons
if (btnBannerAllowGps) {
  btnBannerAllowGps.addEventListener('click', () => {
    if (gpsPermissionBanner) gpsPermissionBanner.classList.add('hidden');
    openGpsPermissionModal();
  });
}
if (btnBannerDismissGps) {
  btnBannerDismissGps.addEventListener('click', () => {
    if (gpsPermissionBanner) gpsPermissionBanner.classList.add('hidden');
    localStorage.setItem('biker_gps_banner_dismissed', 'true');
  });
}

// Sidebar Settings GPS buttons
if (btnSideOpenGpsModal) {
  btnSideOpenGpsModal.addEventListener('click', () => {
    closeSidebar();
    openGpsPermissionModal();
  });
}
if (btnSideGpsTroubleshoot) {
  btnSideGpsTroubleshoot.addEventListener('click', () => {
    closeSidebar();
    openGpsPermissionModal(true);
  });
}

// ตรวจสอบสถานะการอนุญาต GPS ทันทีที่โหลดแอป
checkGpsPermission().then((state) => {
  if (state === 'prompt') {
    const isDismissed = localStorage.getItem('biker_gps_banner_dismissed');
    if (!isDismissed && gpsPermissionBanner) {
      setTimeout(() => {
        gpsPermissionBanner.classList.remove('hidden');
      }, 1000);
    }
  }
});

// ============================================================
// 4.6 ปุ่มกดไปยังตำแหน่งปัจจุบันของตัวเอง (Google Maps My Location)
// ============================================================
function locateMeOnMap(options = { showModalOnDenied: true, autoCloseModal: true }) {
  if (!navigator.geolocation) {
    showToast('เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง GPS', 'error');
    updateGpsStatusUI('unsupported');
    return;
  }

  btnMyLocation.disabled = true;
  myLocationIcon.className = 'ph-bold ph-spinner animate-spin text-xl text-brand-500';
  showToast('กำลังค้นหาตำแหน่งพิกัด GPS ปัจจุบันของคุณ...');

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = Math.min(position.coords.accuracy || 50, 500);

      btnMyLocation.disabled = false;
      myLocationIcon.className = 'ph-fill ph-navigation-arrow text-xl text-blue-400';
      updateGpsStatusUI('granted');

      if (options?.autoCloseModal) {
        closeGpsPermissionModal();
        if (gpsPermissionBanner) gpsPermissionBanner.classList.add('hidden');
      }

      if (userLocationMarker) map.removeLayer(userLocationMarker);
      if (userAccuracyCircle) map.removeLayer(userAccuracyCircle);

      userAccuracyCircle = L.circle([lat, lng], {
        radius: accuracy,
        color: '#3b82f6',
        weight: 1,
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
      }).addTo(map);

      const blueDotIcon = L.divIcon({
        className: 'bg-transparent border-none',
        html: '<div class="user-location-dot"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const popupBox = document.createElement('div');
      popupBox.className = 'text-zinc-900 p-1 min-w-[200px]';
      popupBox.innerHTML = `
        <div class="font-bold text-sm mb-0.5">🔵 ตำแหน่งปัจจุบันของคุณ</div>
        <div class="text-[11px] font-mono text-zinc-500 mb-2">${lat.toFixed(5)}, ${lng.toFixed(5)} (ความแม่นยำ ~${Math.round(accuracy)} ม.)</div>
        <button type="button" id="btnPopupMyLocLog" class="w-full bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs py-1.5 px-3 rounded-lg transition">
          ➕ บันทึกทริปที่จุดนี้ (Log Trip Here)
        </button>
      `;

      userLocationMarker = L.marker([lat, lng], { icon: blueDotIcon })
        .addTo(map)
        .bindPopup(popupBox)
        .openPopup();

      map.flyTo([lat, lng], 15, { duration: 1.2 });
      showToast(`พบตำแหน่งปัจจุบันของคุณแล้ว (${lat.toFixed(4)}, ${lng.toFixed(4)})`);

      setTimeout(() => {
        const btnLog = document.getElementById('btnPopupMyLocLog');
        if (btnLog) {
          btnLog.addEventListener('click', () => {
            if (!tripLocationName.value.trim()) {
              tripLocationName.value = 'จุดเริ่มต้นจากตำแหน่งปัจจุบัน';
            }
            tripLat.value = lat.toFixed(6);
            tripLng.value = lng.toFixed(6);
            openLogTripModal();
          });
        }
      }, 50);
    },
    (err) => {
      btnMyLocation.disabled = false;
      myLocationIcon.className = 'ph-bold ph-crosshair text-xl text-brand-500';
      updateGpsStatusUI('denied');

      let errorMsg = `ไม่สามารถดึงตำแหน่งได้ (${err.message})`;
      if (err.code === 1) { // PERMISSION_DENIED
        errorMsg = 'การเข้าถึงตำแหน่งถูกปฏิเสธ (Denied) — กรุณากดอนุญาตในเบราว์เซอร์';
        if (options?.showModalOnDenied) {
          openGpsPermissionModal(true);
        }
      } else if (err.code === 2) {
        errorMsg = 'ไม่สามารถค้นหาสัญญาณ GPS ในขณะนี้ได้';
      } else if (err.code === 3) {
        errorMsg = 'หมดเวลาค้นหาสัญญาณ GPS กรุณาลองใหม่อีกครั้ง';
      }

      showToast(errorMsg, 'error');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

if (btnMyLocation) {
  btnMyLocation.addEventListener('click', () => {
    // Check permission first: if denied, open modal with instructions right away
    checkGpsPermission().then((state) => {
      if (state === 'denied') {
        openGpsPermissionModal(true);
      } else {
        locateMeOnMap({ showModalOnDenied: true, autoCloseModal: true });
      }
    });
  });
}

// ============================================================
// 5. ระบบค้นหาสถานที่ (Place Search / Geocoding เหมือน Google Maps)
// ============================================================
async function searchPlacesByQuery(query) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
    trimmed
  )}&limit=6&addressdetails=1&accept-language=th,en`;

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('ไม่สามารถเชื่อมต่อบริการค้นหาสถานที่ได้');
  return await response.json();
}

let searchDebounceTimer = null;

mapSearchInput.addEventListener('input', () => {
  const q = mapSearchInput.value.trim();
  btnClearSearch.classList.toggle('hidden', q.length === 0);

  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  if (q.length < 2) {
    mapSearchResults.classList.add('hidden');
    return;
  }

  searchDebounceTimer = setTimeout(() => {
    performTopBarSearch(q, false);
  }, 350);
});

btnClearSearch.addEventListener('click', () => {
  mapSearchInput.value = '';
  btnClearSearch.classList.add('hidden');
  mapSearchResults.classList.add('hidden');
  if (searchPinMarker) {
    map.removeLayer(searchPinMarker);
    searchPinMarker = null;
  }
});

mapSearchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = mapSearchInput.value.trim();
  if (!q) return;
  await performTopBarSearch(q, true);
});

async function performTopBarSearch(query, autoFlyFirst = false) {
  mapSearchResults.innerHTML =
    '<div class="px-4 py-3 text-xs text-zinc-400 flex items-center gap-2"><i class="ph ph-spinner animate-spin text-brand-500"></i> กำลังค้นหาสถานที่...</div>';
  mapSearchResults.classList.remove('hidden');

  try {
    const results = await searchPlacesByQuery(query);

    if (!results || results.length === 0) {
      mapSearchResults.innerHTML =
        '<div class="px-4 py-3 text-xs text-zinc-400">ไม่พบสถานที่ที่ตรงกับคำค้นหานี้ ลองระบุชื่ออำเภอหรือจังหวัดเพิ่มเติม</div>';
      return;
    }

    mapSearchResults.innerHTML = '';

    results.forEach((place) => {
      const lat = parseFloat(place.lat);
      const lon = parseFloat(place.lon);
      const shortName = place.name || place.display_name.split(',')[0];

      const item = document.createElement('div');
      item.className =
        'px-4 py-2.5 hover:bg-zinc-800/90 cursor-pointer border-b border-zinc-800/60 last:border-none flex items-start justify-between gap-3 transition';

      item.innerHTML = `
        <div class="flex items-start gap-2.5 overflow-hidden">
          <i class="ph-fill ph-map-pin text-brand-500 text-lg mt-0.5 shrink-0"></i>
          <div class="overflow-hidden">
            <div class="text-sm font-bold text-white truncate">${shortName}</div>
            <div class="text-xs text-zinc-400 truncate">${place.display_name}</div>
          </div>
        </div>
        <span class="text-[11px] text-brand-400 font-semibold shrink-0 mt-1">ดูบนแผนที่ →</span>
      `;

      item.addEventListener('click', () => {
        focusSearchedPlaceOnMap(shortName, place.display_name, lat, lon);
        mapSearchResults.classList.add('hidden');
      });

      mapSearchResults.appendChild(item);
    });

    if (autoFlyFirst && results[0]) {
      const first = results[0];
      const shortName = first.name || first.display_name.split(',')[0];
      focusSearchedPlaceOnMap(shortName, first.display_name, parseFloat(first.lat), parseFloat(first.lon));
    }
  } catch (err) {
    mapSearchResults.innerHTML = `<div class="px-4 py-3 text-xs text-red-400">${err.message}</div>`;
  }
}

function focusSearchedPlaceOnMap(shortName, fullAddress, lat, lon) {
  if (searchPinMarker) {
    map.removeLayer(searchPinMarker);
  }

  map.flyTo([lat, lon], 14, { duration: 1.2 });

  const popupContainer = document.createElement('div');
  popupContainer.className = 'text-zinc-900 p-1 min-w-[210px]';
  popupContainer.innerHTML = `
    <div class="font-bold text-sm mb-0.5">📍 ${shortName}</div>
    <div class="text-xs text-zinc-600 mb-1.5 line-clamp-2">${fullAddress}</div>
    <div class="text-[11px] font-mono text-zinc-500 mb-2">${lat.toFixed(5)}, ${lon.toFixed(5)}</div>
    <button type="button" id="btnPopupLogHere" class="w-full bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs py-1.5 px-3 rounded-lg transition">
      ➕ บันทึกทริปที่จุดนี้ (Log Trip Here)
    </button>
  `;

  searchPinMarker = L.marker([lat, lon]).addTo(map).bindPopup(popupContainer).openPopup();

  setTimeout(() => {
    const btnLogHere = document.getElementById('btnPopupLogHere');
    if (btnLogHere) {
      btnLogHere.addEventListener('click', () => {
        if (!tripTitle.value.trim()) {
          tripTitle.value = `ทริป${shortName}`;
        }
        tripLocationName.value = shortName;
        tripLat.value = lat.toFixed(6);
        tripLng.value = lon.toFixed(6);
        openLogTripModal();
      });
    }
  }, 50);
}

document.addEventListener('click', (e) => {
  if (!mapSearchForm.contains(e.target) && !mapSearchResults.contains(e.target)) {
    mapSearchResults.classList.add('hidden');
  }
});

// ============================================================
// 5.1 ระบบนำทางและคำนวณเส้นทางขับขี่จริง (Google Maps Style Routing / OSRM)
// ============================================================
let activeRouteData = null;
let routeStartPoint = null; // { name, lat, lng }
let routeEndPoint = null;   // { name, lat, lng }
let routeWaypoints = [];    // array of { name, lat, lng }

function formatDurationThai(seconds) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} นาที`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hours} ชม. ${remainMins} นาที` : `${hours} ชั่วโมง`;
}

function formatDistanceKm(meters) {
  return `${(meters / 1000).toFixed(1)} กม.`;
}

function toggleDirectionsPanel() {
  if (!directionsCard) return;
  const isHidden = directionsCard.classList.contains('hidden');
  if (isHidden) {
    directionsCard.classList.remove('hidden');
    // ถ้าผู้ใช้เคยดึง GPS ไว้ ให้ใส่เป็นจุดเริ่มต้นทันที
    if (!routeStartPoint && userLocationMarker) {
      const pos = userLocationMarker.getLatLng();
      routeStartPoint = { name: 'ตำแหน่งปัจจุบันของคุณ (GPS)', lat: pos.lat, lng: pos.lng };
      routeInputStart.value = routeStartPoint.name;
    }
  } else {
    directionsCard.classList.add('hidden');
  }
}

if (btnToggleDirectionsPanel) {
  btnToggleDirectionsPanel.addEventListener('click', toggleDirectionsPanel);
}
if (btnCloseDirectionsCard) {
  btnCloseDirectionsCard.addEventListener('click', () => {
    directionsCard.classList.add('hidden');
  });
}

// ผูกระบบ Auto-Suggest สำหรับช่อง Start
let suggestDebounceStart = null;
if (routeInputStart) {
  routeInputStart.addEventListener('input', () => {
    const q = routeInputStart.value.trim();
    if (suggestDebounceStart) clearTimeout(suggestDebounceStart);
    if (q.length < 2) {
      routeStartSuggest.classList.add('hidden');
      return;
    }
    suggestDebounceStart = setTimeout(async () => {
      try {
        const places = await searchPlacesByQuery(q);
        routeStartSuggest.innerHTML = '';
        if (!places.length) {
          routeStartSuggest.classList.add('hidden');
          return;
        }
        places.forEach((p) => {
          const item = document.createElement('div');
          item.className = 'px-3 py-2 hover:bg-zinc-800 cursor-pointer border-b border-zinc-800 text-zinc-200';
          const short = p.name || p.display_name.split(',')[0];
          item.innerHTML = `<span class="font-bold text-white">📍 ${short}</span><div class="text-[11px] text-zinc-400 truncate">${p.display_name}</div>`;
          item.addEventListener('click', () => {
            routeStartPoint = { name: short, lat: parseFloat(p.lat), lng: parseFloat(p.lon) };
            routeInputStart.value = short;
            routeStartSuggest.classList.add('hidden');
          });
          routeStartSuggest.appendChild(item);
        });
        routeStartSuggest.classList.remove('hidden');
      } catch (err) {
        console.warn('Suggest err:', err);
      }
    }, 300);
  });
}

// ผูกระบบ Auto-Suggest สำหรับช่อง End (Destination)
let suggestDebounceEnd = null;
if (routeInputEnd) {
  routeInputEnd.addEventListener('input', () => {
    const q = routeInputEnd.value.trim();
    if (suggestDebounceEnd) clearTimeout(suggestDebounceEnd);
    if (q.length < 2) {
      routeEndSuggest.classList.add('hidden');
      return;
    }
    suggestDebounceEnd = setTimeout(async () => {
      try {
        const places = await searchPlacesByQuery(q);
        routeEndSuggest.innerHTML = '';
        if (!places.length) {
          routeEndSuggest.classList.add('hidden');
          return;
        }
        places.forEach((p) => {
          const item = document.createElement('div');
          item.className = 'px-3 py-2 hover:bg-zinc-800 cursor-pointer border-b border-zinc-800 text-zinc-200';
          const short = p.name || p.display_name.split(',')[0];
          item.innerHTML = `<span class="font-bold text-white">🏁 ${short}</span><div class="text-[11px] text-zinc-400 truncate">${p.display_name}</div>`;
          item.addEventListener('click', () => {
            routeEndPoint = { name: short, lat: parseFloat(p.lat), lng: parseFloat(p.lon) };
            routeInputEnd.value = short;
            routeEndSuggest.classList.add('hidden');
          });
          routeEndSuggest.appendChild(item);
        });
        routeEndSuggest.classList.remove('hidden');
      } catch (err) {
        console.warn('Suggest err:', err);
      }
    }, 300);
  });
}

if (btnRouteUseCurrentGps) {
  btnRouteUseCurrentGps.addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('เบราว์เซอร์ไม่รองรับ GPS', 'error');
      return;
    }
    btnRouteUseCurrentGps.innerHTML = '<i class="ph-bold ph-spinner animate-spin text-sm"></i>';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        btnRouteUseCurrentGps.innerHTML = '<i class="ph-bold ph-crosshair text-sm"></i>';
        routeStartPoint = {
          name: 'ตำแหน่งปัจจุบันของคุณ (GPS)',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        routeInputStart.value = routeStartPoint.name;
        showToast('เลือกจุดเริ่มต้นเป็นพิกัดปัจจุบันของคุณแล้ว 🟢');
      },
      (err) => {
        btnRouteUseCurrentGps.innerHTML = '<i class="ph-bold ph-crosshair text-sm"></i>';
        showToast(`ไม่สามารถดึง GPS ได้: ${err.message}`, 'error');
      }
    );
  });
}

// สลับจุดเริ่มต้นและจุดสิ้นสุด
if (btnRouteSwapPoints) {
  btnRouteSwapPoints.addEventListener('click', () => {
    const tempP = routeStartPoint;
    routeStartPoint = routeEndPoint;
    routeEndPoint = tempP;

    const tempVal = routeInputStart.value;
    routeInputStart.value = routeInputEnd.value;
    routeInputEnd.value = tempVal;

    if (routeStartPoint && routeEndPoint) {
      calculateAndDrawRoute();
    }
  });
}

// เพิ่มจุดแวะพัก (Waypoint) แบบไดนามิก
function renderRouteWaypointsInputs() {
  if (!routeWaypointsContainer) return;
  routeWaypointsContainer.innerHTML = '';
  routeWaypoints.forEach((wp, index) => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 relative';
    row.innerHTML = `
      <span class="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-400/20 shrink-0 ml-1"></span>
      <input
        type="text"
        placeholder="จุดแวะที่ ${index + 1} (เช่น ปั๊ม PTT, ร้านกาแฟ)..."
        value="${wp.name || ''}"
        class="wp-input flex-1 bg-zinc-900 border border-zinc-700/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-brand-500"
      />
      <button type="button" class="btn-del-wp text-zinc-500 hover:text-red-400 font-bold px-2 py-1 text-sm">✕</button>
      <div class="wp-suggest hidden absolute top-full left-5 right-8 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl max-h-32 overflow-y-auto z-20 shadow-xl text-xs"></div>
    `;

    const input = row.querySelector('.wp-input');
    const suggest = row.querySelector('.wp-suggest');
    const btnDel = row.querySelector('.btn-del-wp');

    btnDel.addEventListener('click', () => {
      routeWaypoints.splice(index, 1);
      renderRouteWaypointsInputs();
      if (routeStartPoint && routeEndPoint) calculateAndDrawRoute();
    });

    let debTimer = null;
    input.addEventListener('input', () => {
      const q = input.value.trim();
      if (debTimer) clearTimeout(debTimer);
      if (q.length < 2) {
        suggest.classList.add('hidden');
        return;
      }
      debTimer = setTimeout(async () => {
        try {
          const places = await searchPlacesByQuery(q);
          suggest.innerHTML = '';
          if (!places.length) {
            suggest.classList.add('hidden');
            return;
          }
          places.forEach((p) => {
            const short = p.name || p.display_name.split(',')[0];
            const item = document.createElement('div');
            item.className = 'px-3 py-1.5 hover:bg-zinc-800 cursor-pointer border-b border-zinc-800 text-zinc-200';
            item.innerHTML = `<strong>🟠 ${short}</strong><div class="text-[10px] text-zinc-400 truncate">${p.display_name}</div>`;
            item.addEventListener('click', () => {
              routeWaypoints[index] = { name: short, lat: parseFloat(p.lat), lng: parseFloat(p.lon) };
              input.value = short;
              suggest.classList.add('hidden');
            });
            suggest.appendChild(item);
          });
          suggest.classList.remove('hidden');
        } catch {
          // ignore
        }
      }, 300);
    });

    routeWaypointsContainer.appendChild(row);
  });
}

if (btnAddRouteWaypoint) {
  btnAddRouteWaypoint.addEventListener('click', () => {
    routeWaypoints.push({ name: '', lat: null, lng: null });
    renderRouteWaypointsInputs();
  });
}

// ฟังก์ชันหลัก: คำนวณเส้นทางขับขี่จริงผ่าน OSRM API (โค้งตามถนน 100%)
async function calculateAndDrawRoute() {
  // หากยังไม่ได้เลือกจุดพิกัด ให้ลองค้นหาจากข้อความในกล่อง
  if (!routeStartPoint && routeInputStart?.value.trim()) {
    const res = await searchPlacesByQuery(routeInputStart.value.trim());
    if (res[0]) {
      routeStartPoint = {
        name: res[0].name || res[0].display_name.split(',')[0],
        lat: parseFloat(res[0].lat),
        lng: parseFloat(res[0].lon),
      };
    }
  }
  if (!routeEndPoint && routeInputEnd?.value.trim()) {
    const res = await searchPlacesByQuery(routeInputEnd.value.trim());
    if (res[0]) {
      routeEndPoint = {
        name: res[0].name || res[0].display_name.split(',')[0],
        lat: parseFloat(res[0].lat),
        lng: parseFloat(res[0].lon),
      };
    }
  }

  if (!routeStartPoint || !routeEndPoint) {
    showToast('กรุณาระบุทั้งจุดเริ่มต้นและจุดหมายปลายทางครับ 🗺️', 'error');
    return;
  }

  btnCalculateRoute.disabled = true;
  btnCalculateRoute.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> กำลังคำนวณ...';

  try {
    // รวมจุดพิกัดทั้งหมดตามลำดับ: Start -> Waypoints -> End
    const allCoords = [
      routeStartPoint,
      ...routeWaypoints.filter((w) => w.lat && w.lng),
      routeEndPoint,
    ];

    // รูปแบบ URL ของ OSRM: lng,lat;lng,lat (OSRM ใช้ lng ก่อน lat)
    const coordString = allCoords.map((c) => `${c.lng},${c.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

    const resp = await fetch(url);
    if (!resp.ok) throw new Error('ไม่สามารถเชื่อมต่อระบบคำนวณเส้นทางได้');
    const data = await resp.json();

    if (data.code !== 'Ok' || !data.routes || !data.routes.length) {
      throw new Error('ไม่พบเส้นทางขับขี่ระหว่างจุดที่ระบุ');
    }

    const route = data.routes[0];
    activeRouteData = {
      route,
      points: allCoords,
      coordinates: route.geometry.coordinates.map((c) => [c[1], c[0]]), // แปลงกลับเป็น [lat, lng] สำหรับ Leaflet
    };

    // ล้างเส้นทางเก่าและวาดเส้นใหม่
    activeDirectionsLayer.clearLayers();

    // 1. วาดเส้นขอบเรืองแสงสีฟ้าอมส้มสไตล์ Google Maps
    const routeOutline = L.polyline(activeRouteData.coordinates, {
      color: '#1e40af', // Blue 800
      weight: 8,
      opacity: 0.6,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(activeDirectionsLayer);

    // 2. วาดเส้นทางขับขี่หลัก (สีฟ้าสว่างหรือส้มสว่าง เลี้ยวโค้งตามถนน)
    const routePath = L.polyline(activeRouteData.coordinates, {
      color: '#3b82f6', // Blue 500
      weight: 5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(activeDirectionsLayer);

    // 3. ปักหมุด Start, Waypoints, End สไตล์ Google Maps
    const startIcon = L.divIcon({
      className: 'bg-transparent border-none',
      html: `
        <div class="flex items-center gap-1 bg-emerald-500 text-zinc-950 font-black text-xs px-2.5 py-1 rounded-full shadow-2xl border-2 border-white animate-bounce">
          <span>🟢</span>
          <span>${routeStartPoint.name}</span>
        </div>
      `,
      iconSize: [120, 30],
      iconAnchor: [60, 30],
    });
    L.marker([routeStartPoint.lat, routeStartPoint.lng], { icon: startIcon }).addTo(activeDirectionsLayer);

    routeWaypoints.forEach((wp, i) => {
      if (!wp.lat || !wp.lng) return;
      const wpIcon = L.divIcon({
        className: 'bg-transparent border-none',
        html: `
          <div class="flex items-center gap-1 bg-amber-500 text-zinc-950 font-black text-xs px-2 py-0.5 rounded-full shadow-xl border border-white">
            <span>🟠</span>
            <span>${wp.name || `จุดแวะ ${i + 1}`}</span>
          </div>
        `,
        iconSize: [100, 26],
        iconAnchor: [50, 26],
      });
      L.marker([wp.lat, wp.lng], { icon: wpIcon }).addTo(activeDirectionsLayer);
    });

    const endIcon = L.divIcon({
      className: 'bg-transparent border-none',
      html: `
        <div class="flex items-center gap-1 bg-red-600 text-white font-black text-xs px-2.5 py-1 rounded-full shadow-2xl border-2 border-white animate-pulse">
          <span>🏁</span>
          <span>${routeEndPoint.name}</span>
        </div>
      `,
      iconSize: [120, 30],
      iconAnchor: [60, 30],
    });
    L.marker([routeEndPoint.lat, routeEndPoint.lng], { icon: endIcon }).addTo(activeDirectionsLayer);

    // ปรับมุมมองกล้องบนแผนที่ให้พอดีกับเส้นทางทั้งหมด (Fit Bounds)
    map.fitBounds(routePath.getBounds(), { padding: [50, 50], maxZoom: 14 });

    // แสดงผลข้อมูลสรุป (ระยะทาง + เวลา)
    if (routeSummaryBox) {
      routeDurationText.textContent = formatDurationThai(route.duration);
      routeDistanceText.textContent = `(${formatDistanceKm(route.distance)})`;
      routeViaRoadText.textContent = `เส้นทางผ่าน: ${allCoords.map((c) => c.name).join(' ➔ ')}`;
      routeSummaryBox.classList.remove('hidden');
    }

    showToast(`คำนวณเส้นทางสำเร็จ! ระยะทาง ${formatDistanceKm(route.distance)} (${formatDurationThai(route.duration)}) 🏍️🛣️`);
  } catch (err) {
    showToast(`คำนวณเส้นทางไม่สำเร็จ: ${err.message}`, 'error');
  } finally {
    btnCalculateRoute.disabled = false;
    btnCalculateRoute.innerHTML = '<i class="ph-bold ph-compass"></i> ค้นหาเส้นทาง';
  }
}

if (btnCalculateRoute) {
  btnCalculateRoute.addEventListener('click', calculateAndDrawRoute);
}

if (btnClearActiveRoute) {
  btnClearActiveRoute.addEventListener('click', () => {
    activeDirectionsLayer.clearLayers();
    activeRouteData = null;
    routeSummaryBox.classList.add('hidden');
    showToast('ล้างเส้นทางขับขี่เรียบร้อย');
  });
}

// แปลงเส้นทางที่คำนวณได้ ส่งต่อให้ฟอร์ม Log Trip ทันที
if (btnSaveRouteAsTrip) {
  btnSaveRouteAsTrip.addEventListener('click', () => {
    if (!activeRouteData || !routeStartPoint || !routeEndPoint) return;
    directionsCard.classList.add('hidden');

    // นำชื่อเส้นทางไปใส่ในฟอร์ม Log Trip
    tripTitle.value = `ทริปจาก ${routeStartPoint.name} ไป ${routeEndPoint.name}`;
    tripLocationName.value = routeStartPoint.name;
    tripLat.value = routeStartPoint.lat.toFixed(6);
    tripLng.value = routeStartPoint.lng.toFixed(6);
    tripDesc.value = `ขี่มอเตอร์ไซค์จาก ${routeStartPoint.name} ไปยัง ${routeEndPoint.name} ระยะทางประมาณ ${formatDistanceKm(activeRouteData.route.distance)} ใช้เวลาเดินทางประมาณ ${formatDurationThai(activeRouteData.route.duration)}`;

    openLogTripModal();
    showToast('นำข้อมูลเส้นทางมาใส่ในฟอร์มบันทึกทริปเรียบร้อย! เติมรูปภาพแล้วบันทึกได้เลย 🏍️');
  });
}

btnModalSearchPlace.addEventListener('click', async () => {
  const q = tripLocationName.value.trim();
  if (!q) {
    showToast('กรุณาพิมพ์ชื่อสถานที่ก่อนกดค้นหาพิกัด', 'error');
    return;
  }

  modalPlaceSearchResults.innerHTML =
    '<div class="px-3 py-2 text-xs text-zinc-400">กำลังค้นหาพิกัด...</div>';
  modalPlaceSearchResults.classList.remove('hidden');

  try {
    const results = await searchPlacesByQuery(q);
    if (!results.length) {
      modalPlaceSearchResults.innerHTML =
        '<div class="px-3 py-2 text-xs text-zinc-400">ไม่พบสถานที่ ลองพิมพ์ชื่อจังหวัดเพิ่ม</div>';
      return;
    }

    modalPlaceSearchResults.innerHTML = '';
    results.forEach((place) => {
      const lat = parseFloat(place.lat);
      const lon = parseFloat(place.lon);
      const shortName = place.name || place.display_name.split(',')[0];

      const row = document.createElement('div');
      row.className =
        'px-3 py-2 hover:bg-zinc-800 cursor-pointer border-b border-zinc-800 last:border-none text-xs';
      row.innerHTML = `
        <div class="font-bold text-white">📍 ${shortName}</div>
        <div class="text-zinc-400 truncate">${place.display_name}</div>
      `;
      row.addEventListener('click', () => {
        tripLocationName.value = shortName;
        tripLat.value = lat.toFixed(6);
        tripLng.value = lon.toFixed(6);
        if (!tripTitle.value.trim()) {
          tripTitle.value = `ทริป${shortName}`;
        }
        modalPlaceSearchResults.classList.add('hidden');
        map.setView([lat, lon], 13);
        showToast(`ดึงพิกัด "${shortName}" สำเร็จ!`);
      });
      modalPlaceSearchResults.appendChild(row);
    });
  } catch (err) {
    modalPlaceSearchResults.innerHTML = `<div class="px-3 py-2 text-xs text-red-400">${err.message}</div>`;
  }
});

btnCpSearchPlace.addEventListener('click', async () => {
  const q = cpLocationName.value.trim();
  if (!q) {
    showToast('กรุณาพิมพ์ชื่อจุดแวะพักก่อนกดค้นหาพิกัด', 'error');
    return;
  }

  btnCpSearchPlace.textContent = 'กำลังค้นหา...';
  try {
    const results = await searchPlacesByQuery(q);
    if (!results.length) {
      showToast('ไม่พบพิกัดของสถานที่นี้ ลองระบุชื่อจังหวัดเพิ่ม', 'error');
      return;
    }
    const first = results[0];
    const lat = parseFloat(first.lat);
    const lon = parseFloat(first.lon);
    cpLat.value = lat.toFixed(6);
    cpLng.value = lon.toFixed(6);
    cpLocationName.value = first.name || first.display_name.split(',')[0];
    showToast(`พบพิกัด: ${cpLat.value}, ${cpLng.value}`);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btnCpSearchPlace.textContent = '🔍 ค้นหาพิกัด';
  }
});

// ============================================================
// 6. Helper Functions (Toast, Date Format, Image Storage)
// ============================================================
let toastTimer = null;
function showToast(message, type = 'success') {
  if (toastTimer) clearTimeout(toastTimer);
  toastBox.textContent = message;
  if (type === 'error') {
    toastBox.className =
      'fixed top-20 left-1/2 -translate-x-1/2 z-[3000] px-4 py-2.5 rounded-xl border border-red-500/50 bg-red-950/90 text-red-200 text-sm font-medium shadow-2xl backdrop-blur-md flex items-center gap-2 transition-all';
  } else {
    toastBox.className =
      'fixed top-20 left-1/2 -translate-x-1/2 z-[3000] px-4 py-2.5 rounded-xl border border-brand-500/50 bg-zinc-900/95 text-brand-400 text-sm font-medium shadow-2xl backdrop-blur-md flex items-center gap-2 transition-all';
  }
  toastBox.classList.remove('hidden');
  toastTimer = setTimeout(() => {
    toastBox.classList.add('hidden');
  }, 4200);
}

function formatReadableDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return 'เมื่อสักครู่';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
  return formatReadableDate(dateStr);
}

function resolvePhotoUrl(imagePath) {
  if (!imagePath) return DEFAULT_TRIP_IMAGE;
  if (imagePath.startsWith('data:') || imagePath.startsWith('http')) {
    return imagePath;
  }
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(imagePath);
  return data?.publicUrl || DEFAULT_TRIP_IMAGE;
}

function compressImageToDataUrl(file, maxWidth = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadTripImageFile(file, tripId) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safePath = `${currentUser.id}/${tripId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(safePath, file, { cacheControl: '3600', upsert: false });

  if (uploadError) {
    console.warn('Fallback to compressed image data URL:', uploadError.message);
    return await compressImageToDataUrl(file);
  }
  return safePath;
}

// ============================================================
// 7. Render Markers & Route Polylines on Map
// ============================================================
function getAllDisplayedTrips() {
  if (appSettings.showDemoTrips === false) {
    return [...userTrips];
  }
  return [...userTrips, ...showcaseTrips];
}

// Helper สร้างไอคอน Marker บนแผนที่ตามประเภท (Start, Waypoint, End)
function createPointMarkerIcon(pointType, labelText, imgUrl = null) {
  let badgeColor = 'bg-amber-500 border-amber-400 text-zinc-950';
  let dotColor = 'bg-amber-400';
  let defaultEmoji = '🟠';
  let badgeText = labelText || 'จุดแวะ';

  if (pointType === 'start') {
    badgeColor = 'bg-emerald-500 border-emerald-300 text-zinc-950';
    dotColor = 'bg-emerald-400';
    defaultEmoji = '🟢';
    badgeText = labelText || 'จุดสตาร์ท';
  } else if (pointType === 'end') {
    badgeColor = 'bg-red-600 border-red-400 text-white';
    dotColor = 'bg-red-500';
    defaultEmoji = '🏁';
    badgeText = labelText || 'ปลายทาง';
  }

  if (imgUrl) {
    return L.divIcon({
      className: 'bg-transparent border-none',
      html: `
        <div class="relative w-14 h-14 rounded-full border-2 ${
          pointType === 'start'
            ? 'border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.7)]'
            : pointType === 'end'
            ? 'border-red-500 shadow-[0_0_16px_rgba(239,68,68,0.7)]'
            : 'border-brand-500 shadow-[0_0_15px_rgba(245,158,11,0.6)]'
        } overflow-hidden bg-zinc-900 transform transition-transform hover:scale-110 hover:border-white hover:z-50 cursor-pointer group flex items-center justify-center">
          <img src="${imgUrl}" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" alt="Trip Marker"/>
          <div class="absolute inset-0 ring-inset ring-2 ring-black/20 rounded-full"></div>
          <span class="absolute top-0 right-0 text-[11px] leading-none drop-shadow">${defaultEmoji}</span>
        </div>
        <div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] ${
          pointType === 'start'
            ? 'border-t-emerald-400'
            : pointType === 'end'
            ? 'border-t-red-500'
            : 'border-t-brand-500'
        } drop-shadow-md"></div>
      `,
      iconSize: [56, 64],
      iconAnchor: [28, 64],
    });
  }

  return L.divIcon({
    className: 'bg-transparent border-none',
    html: `
      <div class="relative flex items-center justify-center cursor-pointer group hover:scale-110 transition-transform">
        <div class="px-2 py-0.5 rounded-full ${badgeColor} text-[10px] font-black border shadow-lg flex items-center gap-1 whitespace-nowrap">
          <span>${defaultEmoji}</span>
          <span>${badgeText}</span>
        </div>
      </div>
    `,
    iconSize: [80, 26],
    iconAnchor: [40, 13],
  });
}

function renderMapMarkers() {
  markersLayer.clearLayers();
  routesLayer.clearLayers();

  const allTrips = getAllDisplayedTrips();

  allTrips.forEach((trip) => {
    const cps = Array.isArray(trip.checkpoints) ? [...trip.checkpoints] : [];
    
    // จัดเรียงจุด checkpoints: เรียงตาม order_index จากนั้นตาม created_at
    cps.sort((a, b) => {
      const ordA = a.order_index ?? 0;
      const ordB = b.order_index ?? 0;
      if (ordA !== ordB) return ordA - ordB;
      return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    });

    const firstCp = cps[0];
    const tripStartType = firstCp?.point_type || 'start';

    // 1. หมุดหลักของทริป (Cover Marker)
    const customIcon = createPointMarkerIcon(tripStartType, trip.title, trip.img);

    const marker = L.marker([trip.lat, trip.lng], { icon: customIcon }).addTo(markersLayer);

    marker.on('click', () => {
      if (isPickingMapCoord) return;
      openDetailModal(trip);
      map.panTo(new L.LatLng(trip.lat, trip.lng));
    });

    // 2. วาดเส้น Route Polyline เชื่อมต่อจุดทั้งหมดในทริป
    if (appSettings.showRoutes !== false && cps.length > 1) {
      const latlngs = cps.map((cp) => [Number(cp.latitude), Number(cp.longitude)]);

      // วาดเส้น Outer Glow เพื่อความสวยงามพาดผ่านถนน
      L.polyline(latlngs, {
        color: '#f59e0b',
        weight: 6,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(routesLayer);

      // วาดเส้น Inner Center Line (สีส้มทองคมชัด)
      L.polyline(latlngs, {
        color: '#fef3c7',
        weight: 2,
        opacity: 0.95,
        dashArray: '8, 8',
        lineCap: 'round',
      }).addTo(routesLayer);

      // ปักหมุด Checkpoint ย่อยทั้งหมดตั้งแต่จุดที่ 2 เป็นต้นไป
      cps.slice(1).forEach((cp, idx) => {
        const cpType = cp.point_type || (idx + 2 === cps.length ? 'end' : 'waypoint');
        const defaultName = cpType === 'end' ? 'จุดสิ้นสุด' : `จุดแวะ ${idx + 2}`;
        const subIcon = createPointMarkerIcon(cpType, cp.location_name || defaultName);

        L.marker([Number(cp.latitude), Number(cp.longitude)], { icon: subIcon })
          .bindTooltip(`${trip.title} — ${cp.location_name || defaultName}`)
          .on('click', () => openDetailModal(trip))
          .addTo(markersLayer);
      });
    }
  });

  renderGarageTripsList();
}

// ============================================================
// 8. Trip Detail Modal Interaction (Profile + Bio/Links + Likes/Dislikes + Comments/Replies)
// ============================================================
const REACTIONS_STORAGE_KEY = 'biker_journey_reactions_v1';
const COMMENTS_STORAGE_KEY = 'biker_journey_comments_v1';

function getLocalReactionsMap() {
  try {
    return JSON.parse(localStorage.getItem(REACTIONS_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveLocalReactionsMap(mapObj) {
  localStorage.setItem(REACTIONS_STORAGE_KEY, JSON.stringify(mapObj));
}

function getLocalCommentsMap() {
  try {
    return JSON.parse(localStorage.getItem(COMMENTS_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveLocalCommentsMap(mapObj) {
  localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(mapObj));
}

async function renderReactionsUI(trip) {
  const localMap = getLocalReactionsMap();
  let userReaction = localMap[trip.id] || null;

  let likes = trip.baseLikes || 0;
  let dislikes = trip.baseDislikes || 0;

  if (!trip.isDemo) {
    try {
      const { data: rows, error } = await supabase
        .from('trip_reactions')
        .select('user_id, reaction_type')
        .eq('trip_id', trip.id);

      if (!error && rows) {
        likes = rows.filter((r) => r.reaction_type === 'like').length;
        dislikes = rows.filter((r) => r.reaction_type === 'dislike').length;
        if (currentUser) {
          const myRow = rows.find((r) => r.user_id === currentUser.id);
          userReaction = myRow ? myRow.reaction_type : null;
          if (userReaction) {
            localMap[trip.id] = userReaction;
          } else {
            delete localMap[trip.id];
          }
          saveLocalReactionsMap(localMap);
        }
      } else {
        if (userReaction === 'like') likes += 1;
        if (userReaction === 'dislike') dislikes += 1;
      }
    } catch {
      if (userReaction === 'like') likes += 1;
      if (userReaction === 'dislike') dislikes += 1;
    }
  } else {
    if (userReaction === 'like') likes += 1;
    if (userReaction === 'dislike') dislikes += 1;
  }

  likeCount.textContent = String(likes);
  dislikeCount.textContent = String(dislikes);

  if (userReaction === 'like') {
    btnLikeTrip.className =
      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-brand-500 bg-brand-500 text-zinc-950 shadow-[0_0_12px_rgba(245,158,11,0.4)] transition';
    iconLikeTrip.className = 'ph-fill ph-thumbs-up text-base';
  } else {
    btnLikeTrip.className =
      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-brand-500 transition';
    iconLikeTrip.className = 'ph-bold ph-thumbs-up text-base';
  }

  if (userReaction === 'dislike') {
    btnDislikeTrip.className =
      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-red-500 bg-red-500/20 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.3)] transition';
    iconDislikeTrip.className = 'ph-fill ph-thumbs-down text-base';
  } else {
    btnDislikeTrip.className =
      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-red-500 transition';
    iconDislikeTrip.className = 'ph-bold ph-thumbs-down text-base';
  }
}

async function handleToggleReaction(type) {
  if (!activeModalTrip) return;
  if (!currentUser) {
    showToast('กรุณาเข้าสู่ระบบในหน้า Garage ก่อนกดถูกใจทริปนะครับ 🏍️');
    openGarageModal();
    return;
  }
  const tripId = activeModalTrip.id;
  const localMap = getLocalReactionsMap();
  const current = localMap[tripId] || null;
  const next = current === type ? null : type;

  if (next) {
    localMap[tripId] = next;
  } else {
    delete localMap[tripId];
  }
  saveLocalReactionsMap(localMap);

  if (!activeModalTrip.isDemo) {
    try {
      if (next) {
        const { error } = await supabase.from('trip_reactions').upsert(
          {
            trip_id: tripId,
            user_id: currentUser.id,
            reaction_type: next,
          },
          { onConflict: 'trip_id,user_id' }
        );
        if (error) {
          if (error.code === 'PGRST205') {
            showToast('อย่าลืมรันคำสั่งสร้างตาราง trip_reactions ใน Supabase ก่อนนะครับ', 'error');
          } else {
            showToast(`บันทึกไลค์ไม่สำเร็จ: ${error.message}`, 'error');
          }
        }
      } else {
        await supabase
          .from('trip_reactions')
          .delete()
          .eq('trip_id', tripId)
          .eq('user_id', currentUser.id);
      }
    } catch (err) {
      console.warn('Reaction toggle error:', err);
    }
  }

  await renderReactionsUI(activeModalTrip);
}

btnLikeTrip.addEventListener('click', () => handleToggleReaction('like'));
btnDislikeTrip.addEventListener('click', () => handleToggleReaction('dislike'));

async function saveNewCommentOrReply(tripId, text, parentId = null, replyToUsername = null) {
  if (!currentUser) {
    showToast('กรุณาเข้าสู่ระบบในหน้า Garage ก่อนแสดงความคิดเห็นนะครับ 🏍️');
    openGarageModal();
    return;
  }

  const payload = {
    trip_id: tripId,
    user_id: currentUser.id,
    content: text,
  };
  if (parentId && !String(parentId).startsWith('local-') && !String(parentId).startsWith('cm-demo')) {
    payload.parent_id = parentId;
  }

  const { data: insertedComment, error } = await supabase
    .from('trip_comments')
    .insert([payload])
    .select('id, trip_id, user_id, parent_id, content, created_at')
    .single();

  if (error) {
    console.error('Error saving comment:', error);
    if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
      showToast('กรุณารันคำสั่ง SQL สร้างตาราง trip_comments ใน Supabase ก่อนนะครับ', 'error');
    } else {
      showToast(`ส่งความคิดเห็นไม่สำเร็จ: ${error.message}`, 'error');
    }
    throw error;
  }

  // ส่งแจ้งเตือนไปยังเจ้าของทริป (ตรวจสอบเพื่อไม่ให้ซ้ำกับ SQL trigger)
  try {
    if (activeModalTrip && activeModalTrip.user_id && activeModalTrip.user_id !== currentUser.id) {
      if (insertedComment?.id) {
        // ตรวจสอบว่า SQL Trigger ใน Supabase สร้างแจ้งเตือนไปแล้วหรือยัง ถ้ามีแล้วจะไม่สร้างซ้ำ
        const { data: existingNotif } = await supabase
          .from('notifications')
          .select('id')
          .eq('comment_id', insertedComment.id)
          .limit(1);

        if (existingNotif && existingNotif.length > 0) {
          return;
        }
      }

      const commenterName =
        currentUserProfile?.username ||
        currentUser.user_metadata?.username ||
        currentUser.email?.split('@')[0] ||
        'เพื่อนนักบิด';
      await supabase.from('notifications').insert([
        {
          user_id: activeModalTrip.user_id,
          actor_id: currentUser.id,
          trip_id: tripId,
          comment_id: insertedComment?.id || null,
          type: 'comment',
          message: `${commenterName} ได้แสดงความคิดเห็นในทริป "${activeModalTrip.title}": ${text.slice(0, 70)}`,
        },
      ]);
    }
  } catch (notifErr) {
    console.warn('Notification notice:', notifErr);
  }
}

function createSingleCommentNode(cm, rootParentId, isReply = false) {
  const wrapper = document.createElement('div');
  wrapper.className = isReply
    ? 'bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-2.5 text-xs space-y-1'
    : 'bg-zinc-950 border border-zinc-800/90 rounded-xl p-3 text-xs space-y-1.5';

  const topRow = document.createElement('div');
  topRow.className = 'flex items-center justify-between gap-2';

  const authorWrap = document.createElement('div');
  authorWrap.className = 'flex items-center gap-2 flex-wrap';

  const avatar = document.createElement('div');
  avatar.className =
    'w-6 h-6 rounded-full overflow-hidden bg-brand-500/20 border border-brand-500/60 text-brand-400 font-bold flex items-center justify-center text-[10px] shrink-0';
  if (cm.avatar_url) {
    const img = document.createElement('img');
    img.src = cm.avatar_url;
    img.alt = cm.username || 'Rider';
    img.className = 'w-full h-full object-cover';
    avatar.appendChild(img);
  } else {
    avatar.textContent = (cm.username || 'R').charAt(0).toUpperCase();
  }

  const nameSpan = document.createElement('span');
  nameSpan.className = 'font-bold text-white';
  nameSpan.textContent = cm.username || 'Rider';

  const bikeSpan = document.createElement('span');
  bikeSpan.className =
    'text-[10px] text-brand-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full';
  bikeSpan.textContent = `🏍️ ${cm.bike_model || 'Biker'}`;

  authorWrap.appendChild(avatar);
  authorWrap.appendChild(nameSpan);
  authorWrap.appendChild(bikeSpan);

  const rightMeta = document.createElement('div');
  rightMeta.className = 'flex items-center gap-2 shrink-0';

  const dateSpan = document.createElement('span');
  dateSpan.className = 'text-[10px] text-zinc-500';
  dateSpan.textContent = cm.created_at || 'เมื่อสักครู่';
  rightMeta.appendChild(dateSpan);

  if (cm.isLocal || (cm.isDb && currentUser && cm.user_id === currentUser.id)) {
    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'text-zinc-500 hover:text-red-400 text-[11px]';
    btnDel.textContent = 'ลบ';
    btnDel.addEventListener('click', () => handleDeleteComment(cm));
    rightMeta.appendChild(btnDel);
  }

  topRow.appendChild(authorWrap);
  topRow.appendChild(rightMeta);

  const bodyP = document.createElement('p');
  bodyP.className = 'text-zinc-300 pl-8 leading-relaxed';
  if (cm.reply_to) {
    const mentionSpan = document.createElement('span');
    mentionSpan.className = 'text-brand-400 font-semibold mr-1';
    mentionSpan.textContent = `@${cm.reply_to}`;
    bodyP.appendChild(mentionSpan);
  }
  bodyP.appendChild(document.createTextNode(cm.content));

  const actionRow = document.createElement('div');
  actionRow.className = 'pl-8 pt-0.5 flex items-center gap-3';

  const btnReply = document.createElement('button');
  btnReply.type = 'button';
  btnReply.className =
    'text-[11px] font-semibold text-zinc-400 hover:text-brand-400 flex items-center gap-1 transition';
  btnReply.innerHTML = '<i class="ph-bold ph-arrow-bend-down-right"></i> ตอบกลับ';

  const replyForm = document.createElement('form');
  replyForm.className = 'hidden pl-8 pt-2 flex gap-1.5 items-center';
  replyForm.innerHTML = `
    <input
      type="text"
      placeholder="ตอบกลับ @${cm.username || 'Rider'}..."
      required
      class="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-brand-500"
    />
    <button type="submit" class="bg-brand-500 hover:bg-brand-600 text-zinc-950 font-bold text-[11px] px-3 py-1.5 rounded-lg shrink-0 transition">
      ส่งคำตอบ
    </button>
    <button type="button" class="btn-cancel-reply text-zinc-400 hover:text-white text-[11px] px-1.5">
      ยกเลิก
    </button>
  `;

  const replyInput = replyForm.querySelector('input');
  const btnCancelReply = replyForm.querySelector('.btn-cancel-reply');

  btnReply.addEventListener('click', () => {
    replyForm.classList.toggle('hidden');
    if (!replyForm.classList.contains('hidden')) {
      replyInput.focus();
    }
  });

  btnCancelReply.addEventListener('click', () => {
    replyForm.classList.add('hidden');
  });

  replyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const replyText = replyInput.value.trim();
    if (!replyText || !activeModalTrip) return;

    await saveNewCommentOrReply(
      activeModalTrip.id,
      replyText,
      rootParentId,
      cm.username || 'Rider'
    );
    showToast(`ตอบกลับ @${cm.username || 'Rider'} เรียบร้อยแล้ว! ↩️`);
    await renderCommentsUI(activeModalTrip);
  });

  actionRow.appendChild(btnReply);
  wrapper.appendChild(topRow);
  wrapper.appendChild(bodyP);
  wrapper.appendChild(actionRow);
  wrapper.appendChild(replyForm);

  return wrapper;
}

async function renderCommentsUI(trip) {
  modalCommentsList.innerHTML = '<div class="text-xs text-zinc-500 text-center py-3">กำลังโหลดความคิดเห็น...</div>';
  let dbComments = [];

  if (!trip.isDemo) {
    try {
      const { data, error } = await supabase
        .from('trip_comments')
        .select(`
          id,
          parent_id,
          content,
          created_at,
          user_id,
          profiles (
            id,
            username,
            bike_model,
            avatar_url
          )
        `)
        .eq('trip_id', trip.id)
        .order('created_at', { ascending: true });

      if (error) {
        if (error.code === 'PGRST205') {
          console.warn('ตาราง trip_comments ยังไม่ได้ถูกสร้างใน Supabase: กรุณารัน update_comments_and_notifications.sql');
        } else {
          console.error('Error fetching comments from Supabase:', error);
        }
      } else if (data) {
        dbComments = data.map((row) => ({
          id: row.id,
          parent_id: row.parent_id || null,
          user_id: row.user_id,
          username: row.profiles?.username || 'Rider',
          bike_model: row.profiles?.bike_model || 'Motorcycle',
          avatar_url: row.profiles?.avatar_url || '',
          content: row.content,
          created_at: formatReadableDate(row.created_at),
          isDb: true,
        }));
      }
    } catch (err) {
      console.warn('Error loading comments:', err);
    }
  }

  const baseComments = trip.defaultComments || [];
  const combined = [...baseComments, ...dbComments];

  commentCount.textContent = String(combined.length);

  if (combined.length === 0) {
    modalCommentsList.innerHTML =
      '<div class="text-xs text-zinc-500 text-center py-4 bg-zinc-950/60 rounded-xl border border-zinc-800/60">ยังไม่มีความคิดเห็น เป็นคนแรกที่คอมเมนต์ทริปนี้เลย! 💬</div>';
    return;
  }

  modalCommentsList.innerHTML = '';
  const topLevelComments = combined.filter((c) => !c.parent_id);
  const repliesByParent = {};
  combined
    .filter((c) => c.parent_id)
    .forEach((reply) => {
      if (!repliesByParent[reply.parent_id]) {
        repliesByParent[reply.parent_id] = [];
      }
      repliesByParent[reply.parent_id].push(reply);
    });

  topLevelComments.forEach((parentCm) => {
    const parentCard = createSingleCommentNode(parentCm, parentCm.id, false);
    const replies = repliesByParent[parentCm.id] || [];

    if (replies.length > 0) {
      const repliesContainer = document.createElement('div');
      repliesContainer.className =
        'border-l-2 border-brand-500/40 pl-3 ml-6 mt-2 space-y-2';

      replies.forEach((rep) => {
        const replyNode = createSingleCommentNode(rep, parentCm.id, true);
        repliesContainer.appendChild(replyNode);
      });

      parentCard.appendChild(repliesContainer);
    }

    modalCommentsList.appendChild(parentCard);
  });
}

formAddComment.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!activeModalTrip) return;

  const text = inputCommentText.value.trim();
  if (!text) return;

  btnSubmitComment.disabled = true;

  try {
    await saveNewCommentOrReply(activeModalTrip.id, text, null, null);
    inputCommentText.value = '';
    showToast('ส่งความคิดเห็นเรียบร้อยแล้ว! 💬');
    await renderCommentsUI(activeModalTrip);
  } catch (err) {
    showToast(`ไม่สามารถส่งความคิดเห็นได้: ${err.message}`, 'error');
  } finally {
    btnSubmitComment.disabled = false;
  }
});

async function handleDeleteComment(cm) {
  if (!activeModalTrip) return;

  if (cm.isDb && currentUser) {
    await supabase.from('trip_comments').delete().eq('id', cm.id).eq('user_id', currentUser.id);
  } else {
    const localCommentsMap = getLocalCommentsMap();
    const list = (localCommentsMap[activeModalTrip.id] || []).filter(
      (item) => item.id !== cm.id && item.parent_id !== cm.id
    );
    localCommentsMap[activeModalTrip.id] = list;
    saveLocalCommentsMap(localCommentsMap);
  }

  showToast('ลบความคิดเห็นแล้ว');
  await renderCommentsUI(activeModalTrip);
}

// ============================================================
// Full-Screen Image Lightbox Viewer (ระบบกดดูรูปภาพขนาดเต็ม + สไลด์ + ซูม)
// ============================================================
let lightboxPhotos = [];
let currentLightboxIndex = 0;
let currentLightboxTitle = 'รูปภาพทริป';
let currentDetailPhotoIndex = 0;

function openImageLightbox(photosArray, startIndex = 0, title = 'รูปภาพทริป') {
  if (!photosArray) return;
  const list = (Array.isArray(photosArray) ? photosArray : [photosArray]).filter(Boolean);
  if (list.length === 0) return;

  lightboxPhotos = list;
  currentLightboxIndex = Math.max(0, Math.min(startIndex, list.length - 1));
  currentLightboxTitle = title || 'รูปภาพทริป';

  updateLightboxDisplay();
  if (imageLightboxModal) {
    imageLightboxModal.classList.remove('hidden');
  }
}

function updateLightboxDisplay() {
  if (!imageLightboxModal || lightboxPhotos.length === 0) return;

  const currentUrl = lightboxPhotos[currentLightboxIndex] || '';
  if (lightboxMainImage) lightboxMainImage.src = currentUrl;
  if (lightboxPhotoTitle) lightboxPhotoTitle.textContent = currentLightboxTitle;
  if (lightboxPhotoIndex) {
    lightboxPhotoIndex.textContent = `รูปที่ ${currentLightboxIndex + 1} / ${lightboxPhotos.length}`;
  }
  if (lightboxViewOriginal) {
    lightboxViewOriginal.href = currentUrl;
  }

  // Delete photo button (visible to owner if more than 1 photo exists)
  if (btnLightboxDeletePhoto) {
    const isOwner = currentUser && activeModalTrip && activeModalTrip.user_id === currentUser.id && !activeModalTrip.isDemo;
    const canDelete = isOwner && (activeModalTrip.photoObjects?.length > 1 || lightboxPhotos.length > 1);
    if (canDelete) {
      btnLightboxDeletePhoto.classList.remove('hidden');
    } else {
      btnLightboxDeletePhoto.classList.add('hidden');
    }
  }

  // Navigation arrows & bottom thumbnails strip
  if (lightboxPhotos.length > 1) {
    if (btnLightboxPrev) btnLightboxPrev.classList.remove('hidden');
    if (btnLightboxNext) btnLightboxNext.classList.remove('hidden');
    if (lightboxThumbsStrip) {
      lightboxThumbsStrip.classList.remove('hidden');
      lightboxThumbsStrip.innerHTML = '';
      lightboxPhotos.forEach((url, idx) => {
        const thumb = document.createElement('img');
        thumb.src = url;
        thumb.alt = `รูปที่ ${idx + 1}`;
        thumb.className = `w-12 h-12 rounded-xl object-cover cursor-pointer transition-all duration-200 shrink-0 ${
          idx === currentLightboxIndex
            ? 'border-2 border-brand-500 scale-105 opacity-100 ring-2 ring-brand-500/50 shadow-lg'
            : 'border border-zinc-700 opacity-60 hover:opacity-100'
        }`;
        thumb.addEventListener('click', (e) => {
          e.stopPropagation();
          currentLightboxIndex = idx;
          updateLightboxDisplay();
        });
        lightboxThumbsStrip.appendChild(thumb);
      });
      const activeThumb = lightboxThumbsStrip.children[currentLightboxIndex];
      if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  } else {
    if (btnLightboxPrev) btnLightboxPrev.classList.add('hidden');
    if (btnLightboxNext) btnLightboxNext.classList.add('hidden');
    if (lightboxThumbsStrip) lightboxThumbsStrip.classList.add('hidden');
  }
}

function closeImageLightbox() {
  if (imageLightboxModal) {
    imageLightboxModal.classList.add('hidden');
  }
  if (lightboxMainImage) {
    lightboxMainImage.src = '';
  }
}

function goToPrevLightboxPhoto() {
  if (lightboxPhotos.length <= 1) return;
  currentLightboxIndex = (currentLightboxIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length;
  updateLightboxDisplay();
}

function goToNextLightboxPhoto() {
  if (lightboxPhotos.length <= 1) return;
  currentLightboxIndex = (currentLightboxIndex + 1) % lightboxPhotos.length;
  updateLightboxDisplay();
}

if (btnLightboxClose) {
  btnLightboxClose.addEventListener('click', closeImageLightbox);
}

if (btnLightboxDeletePhoto) {
  btnLightboxDeletePhoto.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!activeModalTrip || !activeModalTrip.photoObjects) return;
    const isOwner = currentUser && activeModalTrip.user_id === currentUser.id && !activeModalTrip.isDemo;
    if (!isOwner) return;
    if (activeModalTrip.photoObjects.length <= 1) {
      showToast('ต้องมีรูปภาพอย่างน้อย 1 รูปในทริป ไม่สามารถลบรูปสุดท้ายได้ครับ', 'error');
      return;
    }
    const currentPhotoObj = activeModalTrip.photoObjects[currentLightboxIndex];
    if (!currentPhotoObj || !currentPhotoObj.id) {
      showToast('ไม่พบข้อมูลรูปภาพนี้ในฐานข้อมูล', 'error');
      return;
    }
    if (!confirm('คุณต้องการลบรูปภาพที่กำลังเปิดอยู่นี้ออกจากทริปใช่หรือไม่?')) return;
    try {
      const { error } = await supabase.from('trip_photos').delete().eq('id', currentPhotoObj.id);
      if (error) throw error;
      showToast('ลบรูปภาพเรียบร้อยแล้ว 🗑️');

      activeModalTrip.photoObjects.splice(currentLightboxIndex, 1);
      activeModalTrip.photos = activeModalTrip.photoObjects.map((p) => p.url);
      lightboxPhotos = activeModalTrip.photos;

      if (currentLightboxIndex >= lightboxPhotos.length) {
        currentLightboxIndex = Math.max(0, lightboxPhotos.length - 1);
      }
      if (currentDetailPhotoIndex >= activeModalTrip.photos.length) {
        currentDetailPhotoIndex = Math.max(0, activeModalTrip.photos.length - 1);
      }

      updateLightboxDisplay();
      await fetchSupabaseTrips(activeModalTrip.id);
    } catch (err) {
      showToast(`ลบรูปภาพไม่สำเร็จ: ${err.message}`, 'error');
    }
  });
}

if (btnLightboxPrev) {
  btnLightboxPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    goToPrevLightboxPhoto();
  });
}

if (btnLightboxNext) {
  btnLightboxNext.addEventListener('click', (e) => {
    e.stopPropagation();
    goToNextLightboxPhoto();
  });
}

if (imageLightboxModal) {
  imageLightboxModal.addEventListener('click', (e) => {
    if (e.target === imageLightboxModal || e.target === lightboxImageContainer) {
      closeImageLightbox();
    }
  });
}

window.addEventListener('keydown', (e) => {
  if (!imageLightboxModal || imageLightboxModal.classList.contains('hidden')) return;
  if (e.key === 'Escape') {
    closeImageLightbox();
  } else if (e.key === 'ArrowLeft') {
    goToPrevLightboxPhoto();
  } else if (e.key === 'ArrowRight') {
    goToNextLightboxPhoto();
  }
});

let lbTouchStartX = 0;
let lbTouchEndX = 0;
if (imageLightboxModal) {
  imageLightboxModal.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches && e.touches.length > 0) {
        lbTouchStartX = e.touches[0].clientX;
      }
    },
    { passive: true }
  );

  imageLightboxModal.addEventListener(
    'touchend',
    (e) => {
      if (e.changedTouches && e.changedTouches.length > 0) {
        lbTouchEndX = e.changedTouches[0].clientX;
        const deltaX = lbTouchEndX - lbTouchStartX;
        if (Math.abs(deltaX) > 40) {
          if (deltaX < 0) {
            goToNextLightboxPhoto();
          } else {
            goToPrevLightboxPhoto();
          }
        }
      }
    },
    { passive: true }
  );
}

if (modalImageWrap) {
  modalImageWrap.addEventListener('click', () => {
    if (!activeModalTrip) return;
    const photosList = activeModalTrip.photos?.length ? activeModalTrip.photos : [activeModalTrip.img || modalImage.src];
    openImageLightbox(photosList, currentDetailPhotoIndex, activeModalTrip.title);
  });
}

function openDetailModal(trip) {
  activeModalTrip = trip;
  currentDetailPhotoIndex = 0;

  modalImage.src = trip.img || DEFAULT_TRIP_IMAGE;
  modalTitle.textContent = trip.title;
  modalDate.textContent = trip.date;
  modalCoords.textContent = `${Number(trip.lat).toFixed(4)}, ${Number(trip.lng).toFixed(4)}`;
  modalDesc.textContent = trip.desc || 'ไม่มีรายละเอียดเพิ่มเติม';

  // แสดงข้อมูลโปรไฟล์ผู้โพสต์ทริป พร้อมรูปโปรไฟล์และลิงก์โซเชียล
  const localExtra = getLocalProfileExtra();
  const authorName =
    trip.author?.username ||
    currentUserProfile?.username ||
    localExtra.username ||
    currentUser?.email?.split('@')[0] ||
    'Biker Rider';
  const authorBike =
    trip.author?.bike_model ||
    currentUserProfile?.bike_model ||
    localExtra.bike_model ||
    'Adventure Motorcycle';
  const authorAvatar =
    trip.author?.avatar_url ||
    (trip.user_id === currentUser?.id ? (currentUserProfile?.avatar_url || localExtra.avatar_url) : '');
  const authorLinks =
    trip.author?.social_links ||
    currentUserProfile?.social_links ||
    localExtra.social_links ||
    [];

  modalAuthorName.textContent = authorName;
  modalAuthorBike.textContent = `🏍️ ${authorBike}`;
  const initialLetter = authorName.charAt(0).toUpperCase() || '🏍️';
  setAvatarDisplay(modalAuthorAvatarImg, modalAuthorAvatarInitials, authorAvatar, initialLetter);
  renderClickableLinksPills(modalAuthorLinks, authorLinks);

  renderReactionsUI(trip);
  renderCommentsUI(trip);

  const isOwner = currentUser && trip.user_id === currentUser.id;
  if (!trip.isDemo && isOwner) {
    btnEditTripModal.classList.remove('hidden');
    btnDeleteTripModal.classList.remove('hidden');
    labelAddMorePhoto.classList.remove('hidden');
    btnToggleAddCp.classList.remove('hidden');
  } else {
    btnEditTripModal.classList.add('hidden');
    btnDeleteTripModal.classList.add('hidden');
    labelAddMorePhoto.classList.add('hidden');
    btnToggleAddCp.classList.add('hidden');
    formAddCheckpoint.classList.add('hidden');
  }

  modalGallery.innerHTML = '';
  const photosList = trip.photos?.length ? trip.photos : [trip.img];
  const photoObjs = trip.photoObjects || [];
  photosList.forEach((photoUrl, index) => {
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'relative group shrink-0 cursor-pointer';

    const thumb = document.createElement('img');
    thumb.src = photoUrl;
    thumb.alt = trip.title;
    thumb.className = `w-16 h-16 rounded-lg object-cover border-2 ${
      index === currentDetailPhotoIndex
        ? 'border-brand-500 ring-2 ring-brand-500/50 scale-105'
        : 'border-zinc-700 hover:border-brand-500/80'
    } transition-all duration-150`;

    // คลิกสลับรูปใหญ่
    thumbWrap.addEventListener('click', () => {
      currentDetailPhotoIndex = index;
      modalImage.src = photoUrl;
      modalGallery.querySelectorAll('img').forEach((img, i) => {
        img.className = `w-16 h-16 rounded-lg object-cover border-2 ${
          i === index
            ? 'border-brand-500 ring-2 ring-brand-500/50 scale-105'
            : 'border-zinc-700 hover:border-brand-500/80'
        } transition-all duration-150`;
      });
    });

    // ดับเบิ้ลคลิกเพื่อเปิด Lightbox ทันที
    thumbWrap.addEventListener('dblclick', () => {
      openImageLightbox(photosList, index, trip.title);
    });

    thumbWrap.appendChild(thumb);

    // ปุ่มเลือกลบรูปเฉพาะรูปนี้ (สำหรับเจ้าของทริป และมีรูปมากกว่า 1 รูป)
    if (isOwner && !trip.isDemo && photoObjs.length > 1 && photoObjs[index]) {
      const btnDelThumb = document.createElement('button');
      btnDelThumb.type = 'button';
      btnDelThumb.title = 'ลบรูปภาพนี้ออกจากทริป';
      btnDelThumb.className =
        'absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center text-[10px] font-bold shadow-lg transition opacity-80 group-hover:opacity-100 z-10';
      btnDelThumb.innerHTML = '✕';
      btnDelThumb.addEventListener('click', async (e) => {
        e.stopPropagation();
        const targetPhoto = photoObjs[index];
        if (!targetPhoto || !targetPhoto.id) return;
        if (!confirm('คุณต้องการลบรูปภาพนี้ออกจากทริปใช่หรือไม่?')) return;
        try {
          const { error } = await supabase.from('trip_photos').delete().eq('id', targetPhoto.id);
          if (error) throw error;
          showToast('ลบรูปภาพออกจากทริปเรียบร้อยแล้ว 🗑️');
          await fetchSupabaseTrips(trip.id);
        } catch (err) {
          showToast(`ลบรูปภาพไม่สำเร็จ: ${err.message}`, 'error');
        }
      });
      thumbWrap.appendChild(btnDelThumb);
    }

    modalGallery.appendChild(thumbWrap);
  });

  modalCheckpoints.innerHTML = '';
  const cps = Array.isArray(trip.checkpoints) ? [...trip.checkpoints] : [];
  cps.sort((a, b) => {
    const ordA = a.order_index ?? 0;
    const ordB = b.order_index ?? 0;
    if (ordA !== ordB) return ordA - ordB;
    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
  });

  cps.forEach((cp, index) => {
    const row = document.createElement('div');
    row.className =
      'flex items-center justify-between bg-zinc-950 border border-zinc-800/80 rounded-lg px-3 py-2 text-xs cursor-pointer hover:border-brand-500/50 transition';

    const pType = cp.point_type || (index === 0 ? 'start' : index === cps.length - 1 ? 'end' : 'waypoint');
    let typeBadge = '<span class="text-xs">🟠</span> <span class="text-[10px] text-amber-400 font-bold">จุดแวะ</span>';
    if (pType === 'start') {
      typeBadge = '<span class="text-xs">🟢</span> <span class="text-[10px] text-emerald-400 font-bold">จุดเริ่ม</span>';
    } else if (pType === 'end') {
      typeBadge = '<span class="text-xs">🏁</span> <span class="text-[10px] text-red-400 font-bold">ปลายทาง</span>';
    }

    row.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold text-[11px] flex items-center justify-center shrink-0">
          ${index + 1}
        </span>
        <div class="flex flex-col">
          <span class="text-zinc-200 font-medium">${cp.location_name}</span>
          <div class="flex items-center gap-1.5 mt-0.5">
            ${typeBadge}
          </div>
        </div>
      </div>
      <span class="text-zinc-500 font-mono text-[11px]">${Number(cp.latitude).toFixed(4)}, ${Number(cp.longitude).toFixed(4)}</span>
    `;
    row.addEventListener('click', () => {
      map.setView([cp.latitude, cp.longitude], 13);
    });
    modalCheckpoints.appendChild(row);
  });

  detailModal.classList.remove('hidden');
  setTimeout(() => {
    detailModalBox.classList.remove('scale-95', 'opacity-0');
    detailModalBox.classList.add('scale-100', 'opacity-100');
  }, 10);
}

function closeDetailModal() {
  detailModalBox.classList.remove('scale-100', 'opacity-100');
  detailModalBox.classList.add('scale-95', 'opacity-0');
  formAddCheckpoint.classList.add('hidden');
  setTimeout(() => {
    detailModal.classList.add('hidden');
  }, 200);
}

btnCloseDetail.addEventListener('click', closeDetailModal);
detailBackdrop.addEventListener('click', closeDetailModal);

inputAddMorePhoto.addEventListener('change', async () => {
  const files = Array.from(inputAddMorePhoto.files || []);
  if (!files.length || !activeModalTrip || activeModalTrip.isDemo || !currentUser) return;

  showToast(`กำลังอัปโหลดรูปภาพ ${files.length} รูปลงอัลบั้มทริป... 📸`);
  try {
    for (const file of files) {
      const storedPath = await uploadTripImageFile(file, activeModalTrip.id);
      await supabase.from('trip_photos').insert([
        {
          trip_id: activeModalTrip.id,
          image_path: storedPath,
        },
      ]);
    }

    showToast(`เพิ่ม ${files.length} รูปภาพเข้าสู่อัลบั้มทริปสำเร็จ! 📸✨`);
    inputAddMorePhoto.value = '';
    await fetchSupabaseTrips(activeModalTrip.id);
  } catch (err) {
    showToast(`อัปโหลดรูปไม่สำเร็จ: ${err.message}`, 'error');
  }
});

btnToggleAddCp.addEventListener('click', () => {
  formAddCheckpoint.classList.toggle('hidden');
});

btnCpGetGps.addEventListener('click', () => {
  if (!navigator.geolocation) {
    showToast('เบราว์เซอร์ไม่รองรับ GPS', 'error');
    openGpsPermissionModal(true);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      cpLat.value = pos.coords.latitude.toFixed(6);
      cpLng.value = pos.coords.longitude.toFixed(6);
      showToast('ดึงพิกัด GPS ปัจจุบันสำเร็จ!');
    },
    (err) => {
      showToast(`ไม่สามารถดึง GPS ได้: ${err.message}`, 'error');
      if (err.code === 1) openGpsPermissionModal(true);
    }
  );
});

formAddCheckpoint.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!activeModalTrip || activeModalTrip.isDemo) return;

  const locName = cpLocationName.value.trim();
  const latitude = parseFloat(cpLat.value);
  const longitude = parseFloat(cpLng.value);

  const selectedPointTypeRadio = formAddCheckpoint.querySelector('input[name="cpPointTypeRadio"]:checked');
  const pointType = selectedPointTypeRadio ? selectedPointTypeRadio.value : 'waypoint';

  const existingCount = Array.isArray(activeModalTrip.checkpoints) ? activeModalTrip.checkpoints.length : 0;
  const orderIndex = existingCount;

  btnCpSubmit.disabled = true;
  try {
    const { error } = await supabase.from('checkpoints').insert([
      {
        trip_id: activeModalTrip.id,
        location_name: locName,
        latitude,
        longitude,
        point_type: pointType,
        order_index: orderIndex,
      },
    ]);
    if (error) throw error;

    showToast(`เพิ่มจุด "${locName}" บนเส้นทางสำเร็จ! 📍`);
    formAddCheckpoint.reset();
    formAddCheckpoint.classList.add('hidden');
    await fetchSupabaseTrips(activeModalTrip.id);
  } catch (err) {
    showToast(`เพิ่มจุดแวะพักไม่สำเร็จ: ${err.message}`, 'error');
  } finally {
    btnCpSubmit.disabled = false;
  }
});

// เปิดและจัดการ Modal แก้ไขทริป
function renderEditTripExistingPhotos(trip) {
  if (!editTripExistingPhotosContainer || !editTripExistingPhotosList) return;
  const photoObjs = trip.photoObjects || [];
  if (photoObjs.length === 0) {
    editTripExistingPhotosContainer.classList.add('hidden');
    return;
  }
  editTripExistingPhotosContainer.classList.remove('hidden');
  if (editTripExistingCountBadge) {
    editTripExistingCountBadge.textContent = `${photoObjs.length} รูป`;
  }
  editTripExistingPhotosList.innerHTML = '';
  photoObjs.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className =
      'relative group shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900 shadow-sm';

    const img = document.createElement('img');
    img.src = p.url;
    img.className = 'w-full h-full object-cover';
    img.alt = `รูปภาพที่ ${idx + 1}`;
    card.appendChild(img);

    if (photoObjs.length > 1) {
      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.title = 'ลบรูปภาพนี้ออกจากทริป';
      btnDel.className =
        'absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600/90 text-white flex items-center justify-center text-[10px] font-bold opacity-80 group-hover:opacity-100 transition shadow hover:bg-red-500';
      btnDel.innerHTML = '✕';
      btnDel.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm('คุณต้องการลบรูปภาพนี้ออกจากทริปใช่หรือไม่?')) return;
        try {
          const { error } = await supabase.from('trip_photos').delete().eq('id', p.id);
          if (error) throw error;
          showToast('ลบรูปภาพเรียบร้อยแล้ว 🗑️');
          trip.photoObjects.splice(idx, 1);
          trip.photos = trip.photoObjects.map((o) => o.url);
          if (trip.img === p.url) {
            trip.img = trip.photos[0] || DEFAULT_TRIP_IMAGE;
          }
          editTripPhotoPreview.src = trip.img;
          renderEditTripExistingPhotos(trip);
          await fetchSupabaseTrips(trip.id);
        } catch (err) {
          showToast(`ลบรูปภาพไม่สำเร็จ: ${err.message}`, 'error');
        }
      });
      card.appendChild(btnDel);
    }

    editTripExistingPhotosList.appendChild(card);
  });
}

function openEditTripModal(trip) {
  if (!trip || trip.isDemo || !currentUser) return;
  editTripId.value = trip.id;
  editTripTitle.value = trip.title || '';
  editTripDate.value = trip.startDateRaw || '';
  editTripDesc.value = trip.desc || '';
  editTripPhotoPreview.src = trip.img || DEFAULT_TRIP_IMAGE;
  editTripPhotoFilename.textContent = 'คลิกเพื่อเลือกรูปภาพเพิ่ม (เลือกได้หลายรูป)';
  editTripPhotoFile.value = '';
  selectedEditTripFiles = [];
  renderEditTripPhotosPreview();
  renderEditTripExistingPhotos(trip);

  editTripModal.classList.remove('hidden');
}

function closeEditTripModal() {
  editTripModal.classList.add('hidden');
}

let selectedEditTripFiles = [];

function renderEditTripPhotosPreview() {
  if (!editTripPhotoPreviewsList) return;
  editTripPhotoPreviewsList.innerHTML = '';

  if (selectedEditTripFiles.length === 0) {
    editTripPhotoPreviewsList.classList.add('hidden');
    editTripPhotoFilename.textContent = 'คลิกเพื่อเลือกรูปภาพเพิ่ม (เลือกได้หลายรูป)';
    if (editTripPhotoCountBadge) editTripPhotoCountBadge.textContent = 'เพิ่มได้หลายรูป';
    return;
  }

  editTripPhotoPreviewsList.classList.remove('hidden');
  if (editTripPhotoCountBadge) {
    editTripPhotoCountBadge.textContent = `เลือกเพิ่ม ${selectedEditTripFiles.length} รูป`;
  }
  editTripPhotoFilename.textContent = `เลือกเพิ่มแล้ว ${selectedEditTripFiles.length} รูป (คลิกเพื่อเพิ่มอีก)`;

  selectedEditTripFiles.forEach((file, index) => {
    const card = document.createElement('div');
    card.className =
      'relative group aspect-square rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900 shadow-sm';

    const img = document.createElement('img');
    img.className = 'w-full h-full object-cover';
    img.alt = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className =
      'absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600/90 text-white flex items-center justify-center text-[10px] font-bold opacity-80 group-hover:opacity-100 transition shadow hover:bg-red-500';
    btnDel.innerHTML = '✕';
    btnDel.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectedEditTripFiles.splice(index, 1);
      renderEditTripPhotosPreview();
    };

    card.appendChild(img);
    card.appendChild(btnDel);
    editTripPhotoPreviewsList.appendChild(card);
  });
}

if (btnEditTripModal) {
  btnEditTripModal.addEventListener('click', () => {
    if (activeModalTrip) openEditTripModal(activeModalTrip);
  });
}
if (btnCloseEditTrip) btnCloseEditTrip.addEventListener('click', closeEditTripModal);
if (btnCancelEditTrip) btnCancelEditTrip.addEventListener('click', closeEditTripModal);
if (editTripBackdrop) editTripBackdrop.addEventListener('click', closeEditTripModal);

if (editTripPhotoFile) {
  editTripPhotoFile.addEventListener('change', () => {
    const newFiles = Array.from(editTripPhotoFile.files || []);
    if (!newFiles.length) return;
    selectedEditTripFiles.push(...newFiles);
    renderEditTripPhotosPreview();
    editTripPhotoFile.value = '';
  });
}

if (formEditTrip) {
  formEditTrip.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tripId = editTripId.value;
    const newTitle = editTripTitle.value.trim();
    const newDate = editTripDate.value;
    const newDesc = editTripDesc.value.trim();

    if (!tripId || !currentUser) return;

    btnSubmitEditTrip.disabled = true;
    btnSubmitEditTrip.innerHTML = '<span>กำลังบันทึกการแก้ไข...</span>';

    try {
      // 1. อัปเดตข้อมูลทริปลงตาราง trips
      const { error: updateErr } = await supabase
        .from('trips')
        .update({
          title: newTitle,
          start_date: newDate,
          description: newDesc,
        })
        .eq('id', tripId)
        .eq('user_id', currentUser.id);

      if (updateErr) throw updateErr;

      // 2. หากมีการเลือกรูปภาพใหม่เพิ่มเติม ให้อัปโหลดทุกลง storage และแทรกลง trip_photos
      if (selectedEditTripFiles.length > 0) {
        for (let i = 0; i < selectedEditTripFiles.length; i++) {
          btnSubmitEditTrip.innerHTML = `<span>กำลังอัปโหลดรูปภาพ (${i + 1}/${selectedEditTripFiles.length})...</span>`;
          const storedPath = await uploadTripImageFile(selectedEditTripFiles[i], tripId);
          await supabase.from('trip_photos').insert([
            {
              trip_id: tripId,
              image_path: storedPath,
            },
          ]);
        }
      }

      showToast(`แก้ไขทริป "${newTitle}" สำเร็จเรียบร้อย! ✨`);
      closeEditTripModal();
      await fetchSupabaseTrips(tripId);
    } catch (err) {
      showToast(`แก้ไขทริปไม่สำเร็จ: ${err.message}`, 'error');
    } finally {
      btnSubmitEditTrip.disabled = false;
      btnSubmitEditTrip.innerHTML =
        '<i class="ph-bold ph-floppy-disk text-base"></i> บันทึกการแก้ไข';
    }
  });
}

btnDeleteTripModal.addEventListener('click', async () => {
  if (!activeModalTrip || activeModalTrip.isDemo || !currentUser) return;
  if (!confirm(`ต้องการลบทริป "${activeModalTrip.title}" ออกจากแผนที่ใช่หรือไม่?`)) return;

  try {
    const { error } = await supabase
      .from('trips')
      .delete()
      .eq('id', activeModalTrip.id)
      .eq('user_id', currentUser.id);
    if (error) throw error;

    closeDetailModal();
    showToast(`ลบทริป "${activeModalTrip.title}" เรียบร้อยแล้ว`);
    await fetchSupabaseTrips();
  } catch (err) {
    showToast(`ลบทริปไม่สำเร็จ: ${err.message}`, 'error');
  }
});

// ============================================================
// 9. Fetch Trips, Checkpoints & Photos from Supabase (ดึงทริปสาธารณะทั้งหมดของนักบิดทุกคน)
// ============================================================
async function fetchSupabaseTrips(reopenTripId = null) {
  try {
    const { data: tripsData, error: tripsErr } = await supabase
      .from('trips')
      .select(`
        id,
        user_id,
        title,
        description,
        start_date,
        created_at,
        profiles (
          id,
          username,
          bike_model,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false });

    if (tripsErr) throw tripsErr;

    if (!tripsData || tripsData.length === 0) {
      userTrips = [];
      renderMapMarkers();
      renderGarageTripsList();
      return;
    }

    const tripIds = tripsData.map((t) => t.id);

    const [{ data: cpsData }, { data: photosData }] = await Promise.all([
      supabase
        .from('checkpoints')
        .select('id, trip_id, location_name, latitude, longitude, point_type, order_index, created_at')
        .in('trip_id', tripIds)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('trip_photos')
        .select('id, trip_id, image_path, created_at')
        .in('trip_id', tripIds)
        .order('created_at', { ascending: false }),
    ]);

    userTrips = tripsData.map((t) => {
      const tripCps = (cpsData || []).filter((c) => c.trip_id === t.id);
      const tripPhotoRows = (photosData || []).filter((p) => p.trip_id === t.id);
      const tripPhotoObjects = tripPhotoRows.map((p) => ({
        id: p.id,
        trip_id: p.trip_id,
        image_path: p.image_path,
        url: resolvePhotoUrl(p.image_path),
      }));
      const tripPhotoUrls = tripPhotoObjects.map((p) => p.url);

      const firstCp = tripCps[0] || {
        location_name: t.title,
        latitude: 18.7883,
        longitude: 98.9853,
      };

      const authorProfile = t.profiles || {};

      return {
        id: t.id,
        user_id: t.user_id,
        isDemo: false,
        lat: Number(firstCp.latitude),
        lng: Number(firstCp.longitude),
        title: t.title,
        startDateRaw: t.start_date,
        date: formatReadableDate(t.start_date),
        desc: t.description,
        img: tripPhotoUrls[0] || DEFAULT_TRIP_IMAGE,
        author: {
          username: authorProfile.username || 'Rider',
          bike_model: authorProfile.bike_model || 'Biker Motorcycle',
          avatar_url: authorProfile.avatar_url || '',
          social_links: authorProfile.social_links || [],
        },
        baseLikes: 0,
        baseDislikes: 0,
        defaultComments: [],
        checkpoints: tripCps,
        photos: tripPhotoUrls.length ? tripPhotoUrls : [DEFAULT_TRIP_IMAGE],
        photoObjects: tripPhotoObjects,
      };
    });

    renderMapMarkers();
    renderGarageTripsList();

    if (reopenTripId) {
      const updated = userTrips.find((u) => u.id === reopenTripId);
      if (updated) openDetailModal(updated);
    }
  } catch (err) {
    console.error('Error loading trips from Supabase:', err);
    showToast(`โหลดข้อมูลทริปไม่สำเร็จ: ${err.message}`, 'error');
  }
}

// ============================================================
// 10. Log Trip Modal & Click Anywhere on Map to Log Trip
// ============================================================
function openLogTripModal() {
  if (!currentUser) {
    showToast('กรุณาเข้าสู่ระบบในหน้า Garage ก่อนบันทึกทริปใหม่นะครับ 🏍️');
    openGarageModal();
    return;
  }
  logTripModal.classList.remove('hidden');
}

function closeLogTripModal() {
  logTripModal.classList.add('hidden');
  modalPlaceSearchResults.classList.add('hidden');
}

btnOpenLogTrip.addEventListener('click', openLogTripModal);
if (btnMobileLogTrip) {
  btnMobileLogTrip.addEventListener('click', openLogTripModal);
}
btnCloseLogTrip.addEventListener('click', closeLogTripModal);
logTripBackdrop.addEventListener('click', closeLogTripModal);

let selectedLogTripFiles = [];

function renderLogTripPhotosPreview() {
  if (!tripPhotoPreviewsList) return;
  tripPhotoPreviewsList.innerHTML = '';

  if (selectedLogTripFiles.length === 0) {
    tripPhotoPreviewsList.classList.add('hidden');
    tripPhotoFilename.textContent = 'คลิกเพื่อเลือกรูปภาพ (เลือกได้หลายรูป)';
    if (tripPhotoCountBadge) tripPhotoCountBadge.textContent = 'เลือกได้หลายรูป';
    return;
  }

  tripPhotoPreviewsList.classList.remove('hidden');
  if (tripPhotoCountBadge) {
    tripPhotoCountBadge.textContent = `เลือกแล้ว ${selectedLogTripFiles.length} รูป (รูปแรกเป็นหน้าปก)`;
  }
  tripPhotoFilename.textContent = `เลือกแล้ว ${selectedLogTripFiles.length} รูป (คลิกเพื่อเพิ่มอีก)`;

  selectedLogTripFiles.forEach((file, index) => {
    const card = document.createElement('div');
    card.className =
      'relative group aspect-square rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900 shadow-sm';

    const img = document.createElement('img');
    img.className = 'w-full h-full object-cover';
    img.alt = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    // Delete button
    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className =
      'absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600/90 text-white flex items-center justify-center text-[10px] font-bold opacity-80 group-hover:opacity-100 transition shadow hover:bg-red-500';
    btnDel.innerHTML = '✕';
    btnDel.title = 'ลบรูปนี้';
    btnDel.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectedLogTripFiles.splice(index, 1);
      renderLogTripPhotosPreview();
    };

    card.appendChild(img);
    card.appendChild(btnDel);

    // Cover badge on first image
    if (index === 0) {
      const coverBadge = document.createElement('span');
      coverBadge.className =
        'absolute bottom-1 left-1 bg-brand-500 text-zinc-950 text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow pointer-events-none';
      coverBadge.textContent = 'หน้าปก';
      card.appendChild(coverBadge);
    }

    tripPhotoPreviewsList.appendChild(card);
  });
}

if (tripPhotoFile) {
  tripPhotoFile.addEventListener('change', () => {
    const newFiles = Array.from(tripPhotoFile.files || []);
    if (!newFiles.length) return;
    selectedLogTripFiles.push(...newFiles);
    renderLogTripPhotosPreview();
    tripPhotoFile.value = '';
  });
}

btnTripUseGps.addEventListener('click', () => {
  if (!navigator.geolocation) {
    showToast('เบราว์เซอร์ของคุณไม่รองรับ GPS', 'error');
    openGpsPermissionModal(true);
    return;
  }
  btnTripUseGps.textContent = 'กำลังค้นหา...';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      tripLat.value = pos.coords.latitude.toFixed(6);
      tripLng.value = pos.coords.longitude.toFixed(6);
      btnTripUseGps.innerHTML = '<i class="ph-fill ph-navigation-arrow"></i> GPS ปัจจุบัน';
      showToast('ดึงพิกัด GPS ปัจจุบันเรียบร้อย!');
    },
    (err) => {
      btnTripUseGps.innerHTML = '<i class="ph-fill ph-navigation-arrow"></i> GPS ปัจจุบัน';
      showToast(`ไม่สามารถดึง GPS ได้ (${err.message}) — ลองพิมพ์ชื่อสถานที่แล้วกดค้นหาพิกัดได้เลย`, 'error');
      if (err.code === 1) openGpsPermissionModal(true);
    }
  );
});

btnTripPickOnMap.addEventListener('click', () => {
  isPickingMapCoord = true;
  closeLogTripModal();
  pickMapBanner.classList.remove('hidden');
});

btnCancelPickMap.addEventListener('click', () => {
  isPickingMapCoord = false;
  pickMapBanner.classList.add('hidden');
  openLogTripModal();
});

// ============================================================
// Pull-to-Refresh & Manual App Refresh System
// ============================================================
let isRefreshingApp = false;

async function triggerRefreshTrips(showFeedback = true) {
  if (isRefreshingApp) return;
  isRefreshingApp = true;

  if (iconHeaderRefresh) {
    iconHeaderRefresh.classList.add('animate-spin', 'text-brand-400');
  }

  try {
    await fetchSupabaseTrips();
    if (currentUser) {
      currentUserProfile = await ensureAndLoadProfile(currentUser);
      populateProfileUIEverywhere();
      await fetchUserNotifications();
    }
    if (showFeedback) {
      showToast('รีเฟรชข้อมูลทริปและแผนที่ล่าสุดเรียบร้อยแล้ว! 🔄✨');
    }
  } catch (err) {
    if (showFeedback) {
      showToast(`รีเฟรชข้อมูลไม่สำเร็จ: ${err.message}`, 'error');
    }
  } finally {
    isRefreshingApp = false;
    if (iconHeaderRefresh) {
      setTimeout(() => {
        iconHeaderRefresh.classList.remove('animate-spin', 'text-brand-400');
      }, 500);
    }
  }
}

if (btnHeaderRefresh) {
  btnHeaderRefresh.addEventListener('click', () => {
    triggerRefreshTrips(true);
  });
}

// Mobile Touch Pull-to-Refresh Gesture
let ptrStartY = 0;
let ptrCurrentY = 0;
let isPtrActive = false;
const PTR_THRESHOLD = 65;

window.addEventListener(
  'touchstart',
  (e) => {
    const isModalOpen =
      (detailModal && !detailModal.classList.contains('hidden')) ||
      (garageModal && !garageModal.classList.contains('hidden')) ||
      (logTripModal && !logTripModal.classList.contains('hidden')) ||
      (editTripModal && !editTripModal.classList.contains('hidden'));
    if (isModalOpen) return;

    if (e.touches && e.touches.length === 1) {
      const touch = e.touches[0];
      if (touch.clientY <= 160) {
        ptrStartY = touch.clientY;
        isPtrActive = true;
      }
    }
  },
  { passive: true }
);

window.addEventListener(
  'touchmove',
  (e) => {
    if (!isPtrActive || isRefreshingApp) return;
    if (e.touches && e.touches.length === 1) {
      ptrCurrentY = e.touches[0].clientY;
      const pullDistance = ptrCurrentY - ptrStartY;

      if (pullDistance > 8) {
        const damped = Math.min(pullDistance * 0.45, 75);
        if (pullToRefreshIndicator) {
          pullToRefreshIndicator.style.transform = `translate(-50%, ${damped}px)`;
        }

        if (pullDistance >= PTR_THRESHOLD) {
          if (pullToRefreshText) pullToRefreshText.textContent = 'ปล่อยเพื่อรีเฟรชข้อมูล 🔄';
          if (pullToRefreshIcon) pullToRefreshIcon.classList.add('rotate-180');
        } else {
          if (pullToRefreshText) pullToRefreshText.textContent = 'เลื่อนลงเพื่อรีเฟรชข้อมูลทริป';
          if (pullToRefreshIcon) pullToRefreshIcon.classList.remove('rotate-180');
        }
      }
    }
  },
  { passive: true }
);

window.addEventListener('touchend', async () => {
  if (!isPtrActive) return;
  isPtrActive = false;
  const pullDistance = ptrCurrentY - ptrStartY;
  ptrStartY = 0;
  ptrCurrentY = 0;

  if (pullDistance >= PTR_THRESHOLD && !isRefreshingApp) {
    if (pullToRefreshText) pullToRefreshText.textContent = 'กำลังรีเฟรชข้อมูลทริป...';
    if (pullToRefreshIcon) {
      pullToRefreshIcon.className = 'ph-bold ph-arrows-clockwise text-base animate-spin text-brand-400';
    }
    await triggerRefreshTrips(true);
  }

  if (pullToRefreshIndicator) {
    pullToRefreshIndicator.style.transform = 'translate(-50%, -100%)';
  }
  setTimeout(() => {
    if (pullToRefreshText) pullToRefreshText.textContent = 'เลื่อนลงเพื่อรีเฟรชข้อมูลทริป';
    if (pullToRefreshIcon) {
      pullToRefreshIcon.className = 'ph-bold ph-arrow-down text-base transition-transform duration-200';
    }
  }, 300);
});

// ============================================================
// Notification System (แจ้งเตือนเมื่อมีคนคอมเมนต์)
// ============================================================
let userNotifications = [];

async function fetchUserNotifications() {
  if (!currentUser) {
    if (notificationBadge) notificationBadge.classList.add('hidden');
    if (notificationList) {
      notificationList.innerHTML = `
        <div class="text-xs text-zinc-500 text-center py-6">
          <i class="ph ph-user text-2xl text-zinc-600 mb-1.5 block"></i>
          เข้าสู่ระบบเพื่อดูการแจ้งเตือน 🏍️
        </div>
      `;
    }
    return;
  }

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        id,
        trip_id,
        comment_id,
        type,
        message,
        is_read,
        created_at,
        actor:profiles!actor_id (
          username,
          bike_model,
          avatar_url
        )
      `)
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      if (error.code === 'PGRST205') {
        if (notificationList) {
          notificationList.innerHTML = `
            <div class="text-xs text-amber-500 text-center py-5 px-3">
              <i class="ph ph-warning-circle text-2xl mb-1 block"></i>
              ยังไม่ได้สร้างตาราง notifications ใน Supabase<br>(รัน update_comments_and_notifications.sql)
            </div>
          `;
        }
      }
      return;
    }

    // ตัดรายการแจ้งเตือนที่ซ้ำซ้อนออก (Deduplication) เพื่อให้แสดงผล 1 รายการต่อ 1 คอมเมนต์เสมอ
    const seenNotifs = new Set();
    userNotifications = (data || []).filter((n) => {
      const key = n.comment_id
        ? `cm-${n.comment_id}`
        : `${n.trip_id}-${n.actor_id}-${n.message}`;
      if (seenNotifs.has(key)) return false;
      seenNotifs.add(key);
      return true;
    });

    renderNotificationsUI();
  } catch (err) {
    console.warn('Error fetching notifications:', err);
  }
}

function renderNotificationsUI() {
  if (!notificationList) return;

  const unreadCount = userNotifications.filter((n) => !n.is_read).length;
  if (notificationBadge) {
    if (unreadCount > 0) {
      notificationBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      notificationBadge.classList.remove('hidden');
    } else {
      notificationBadge.classList.add('hidden');
    }
  }

  if (userNotifications.length === 0) {
    notificationList.innerHTML = `
      <div class="text-xs text-zinc-500 text-center py-8">
        <i class="ph ph-bell text-2xl text-zinc-600 mb-1.5 block"></i>
        ยังไม่มีการแจ้งเตือนใหม่ 🔔
      </div>
    `;
    return;
  }

  notificationList.innerHTML = '';
  userNotifications.forEach((n) => {
    const item = document.createElement('div');
    item.className = `p-3 rounded-xl transition cursor-pointer flex items-start gap-3 border ${
      n.is_read
        ? 'bg-zinc-900/50 hover:bg-zinc-900 border-zinc-800/80 opacity-80'
        : 'bg-brand-500/10 hover:bg-brand-500/15 border-brand-500/40 shadow-sm'
    }`;

    const actor = n.actor || {};
    const actorName = actor.username || 'เพื่อนนักบิด';
    const avatarContainer = document.createElement('div');
    avatarContainer.className =
      'w-9 h-9 rounded-full overflow-hidden bg-brand-500/20 border border-brand-500/50 flex items-center justify-center shrink-0 mt-0.5 shadow-sm';
    if (actor.avatar_url) {
      const img = document.createElement('img');
      img.src = actor.avatar_url;
      img.className = 'w-full h-full object-cover';
      avatarContainer.appendChild(img);
    } else {
      avatarContainer.innerHTML = `<span class="text-xs font-black text-brand-400">${actorName.charAt(0).toUpperCase()}</span>`;
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'flex-1 overflow-hidden';

    const msgP = document.createElement('p');
    msgP.className = 'text-xs text-zinc-200 leading-snug line-clamp-3';
    msgP.textContent = n.message || 'มีการแสดงความคิดเห็นใหม่ในทริปของคุณ';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'text-[11px] text-zinc-400 mt-1 block font-medium flex items-center gap-1';
    timeSpan.innerHTML = `<i class="ph ph-clock text-xs text-zinc-500"></i> ${formatTimeAgo(n.created_at)}`;

    contentDiv.appendChild(msgP);
    contentDiv.appendChild(timeSpan);

    item.appendChild(avatarContainer);
    item.appendChild(contentDiv);

    if (!n.is_read) {
      const dot = document.createElement('span');
      dot.className =
        'w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-2 shadow-[0_0_8px_rgba(245,158,11,0.8)]';
      item.appendChild(dot);
    }

    item.addEventListener('click', async () => {
      if (!n.is_read) {
        n.is_read = true;
        renderNotificationsUI();
        await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
      }
      if (notificationDropdown) notificationDropdown.classList.add('hidden');

      if (n.trip_id) {
        let targetTrip = userTrips.find((t) => t.id === n.trip_id);
        if (!targetTrip) {
          await fetchSupabaseTrips(n.trip_id);
        } else {
          openDetailModal(targetTrip);
        }
        setTimeout(() => {
          modalCommentsList?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 400);
      }
    });

    notificationList.appendChild(item);
  });
}

async function markAllNotificationsAsRead() {
  if (!currentUser || userNotifications.length === 0) return;
  userNotifications.forEach((n) => (n.is_read = true));
  renderNotificationsUI();
  try {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUser.id);
    showToast('อ่านการแจ้งเตือนทั้งหมดแล้ว ✨');
  } catch (err) {
    console.error('Error marking all read:', err);
  }
}

if (btnOpenNotifications) {
  btnOpenNotifications.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!notificationDropdown) return;
    const isHidden = notificationDropdown.classList.contains('hidden');
    if (isHidden) {
      notificationDropdown.classList.remove('hidden');
      fetchUserNotifications();
    } else {
      notificationDropdown.classList.add('hidden');
    }
  });
}

if (btnMarkAllNotificationsRead) {
  btnMarkAllNotificationsRead.addEventListener('click', markAllNotificationsAsRead);
}

document.addEventListener('click', (e) => {
  if (notificationDropdown && !notificationDropdown.classList.contains('hidden')) {
    if (!notificationDropdown.contains(e.target) && !btnOpenNotifications?.contains(e.target)) {
      notificationDropdown.classList.add('hidden');
    }
  }
});

map.on('click', async (e) => {
  const latNum = e.latlng.lat;
  const lngNum = e.latlng.lng;
  const lat = latNum.toFixed(6);
  const lng = lngNum.toFixed(6);

  if (isPickingMapCoord) {
    tripLat.value = lat;
    tripLng.value = lng;

    if (tempPickMarker) map.removeLayer(tempPickMarker);
    tempPickMarker = L.marker([latNum, lngNum]).addTo(map);

    isPickingMapCoord = false;
    pickMapBanner.classList.add('hidden');
    showToast(`เลือกพิกัด ${lat}, ${lng} เรียบร้อยแล้ว`);
    openLogTripModal();
    return;
  }

  if (appSettings.quickMapClick === false) return;

  if (tempPickMarker) {
    map.removeLayer(tempPickMarker);
  }

  let detectedPlaceName = `จุดเช็คอิน (${latNum.toFixed(3)}, ${lngNum.toFixed(3)})`;

  const popupEl = document.createElement('div');
  popupEl.className = 'text-zinc-900 p-1 min-w-[210px] select-none';
  popupEl.innerHTML = `
    <div id="clickedPlaceTitle" class="font-bold text-sm mb-0.5">📍 พิกัดที่เลือกบนแผนที่</div>
    <div id="clickedPlaceSub" class="text-xs text-zinc-500 mb-1.5">กำลังค้นหาชื่อสถานที่...</div>
    <div class="text-[11px] font-mono text-zinc-500 mb-2">${lat}, ${lng}</div>
    <button type="button" id="btnQuickLogClickedPoint" class="w-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-zinc-950 font-extrabold text-xs py-2 px-3 rounded-lg transition shadow touch-manipulation cursor-pointer flex items-center justify-center gap-1.5">
      <i class="ph-bold ph-plus-circle text-base"></i>
      <span>บันทึกทริปที่จุดนี้</span>
    </button>
  `;

  L.DomEvent.disableClickPropagation(popupEl);
  L.DomEvent.disableScrollPropagation(popupEl);

  tempPickMarker = L.marker([latNum, lngNum], { riseOnHover: true })
    .addTo(map)
    .bindPopup(popupEl, { autoPan: true, closeButton: true })
    .openPopup();

  const btnQuick = popupEl.querySelector('#btnQuickLogClickedPoint');
  if (btnQuick) {
    L.DomEvent.disableClickPropagation(btnQuick);
    const triggerModal = (ev) => {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      tripLocationName.value = detectedPlaceName;
      if (!tripTitle.value.trim()) {
        tripTitle.value = `ทริป${detectedPlaceName}`;
      }
      tripLat.value = lat;
      tripLng.value = lng;
      if (tempPickMarker) tempPickMarker.closePopup();
      openLogTripModal();
    };
    btnQuick.addEventListener('click', triggerModal);
    btnQuick.addEventListener('touchend', triggerModal);
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latNum}&lon=${lngNum}&accept-language=th,en`
    );
    if (res.ok) {
      const data = await res.json();
      const shortName =
        data.name ||
        data.address?.tourism ||
        data.address?.mountain ||
        data.address?.village ||
        data.address?.suburb ||
        data.address?.city ||
        data.address?.state ||
        detectedPlaceName;
      detectedPlaceName = shortName;

      const titleNode = document.getElementById('clickedPlaceTitle');
      const subNode = document.getElementById('clickedPlaceSub');
      if (titleNode) titleNode.textContent = `📍 ${shortName}`;
      if (subNode) subNode.textContent = data.display_name || '';
    }
  } catch {
    const subNode = document.getElementById('clickedPlaceSub');
    if (subNode) subNode.textContent = 'คลิกปุ่มด้านล่างเพื่อบันทึกทริปที่พิกัดนี้';
  }
});

formLogTrip.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const title = tripTitle.value.trim();
  const startDate = tripDate.value;
  const locationName = tripLocationName.value.trim();
  const latitude = parseFloat(tripLat.value);
  const longitude = parseFloat(tripLng.value);
  const description = tripDesc.value.trim();
  btnSubmitLogTrip.disabled = true;
  btnSubmitLogTrip.innerHTML = '<span>กำลังบันทึกทริปและอัปโหลดรูป...</span>';

  try {
    await ensureAndLoadProfile(currentUser);

    const { data: newTrip, error: tripErr } = await supabase
      .from('trips')
      .insert([
        {
          user_id: currentUser.id,
          title,
          start_date: startDate,
          description,
        },
      ])
      .select()
      .single();

    if (tripErr) throw tripErr;

    const selectedTripPointTypeRadio = formLogTrip.querySelector('input[name="tripPointTypeRadio"]:checked');
    const tripPointType = selectedTripPointTypeRadio ? selectedTripPointTypeRadio.value : 'start';

    const { error: cpErr } = await supabase.from('checkpoints').insert([
      {
        trip_id: newTrip.id,
        location_name: locationName,
        latitude,
        longitude,
        point_type: tripPointType,
        order_index: 0,
      },
    ]);
    if (cpErr) throw cpErr;

    // อัปโหลดรูปภาพทั้งหมดที่เลือกไว้ (รองรับหลายรูป)
    if (selectedLogTripFiles.length > 0) {
      for (let i = 0; i < selectedLogTripFiles.length; i++) {
        btnSubmitLogTrip.innerHTML = `<span>กำลังอัปโหลดรูปภาพ (${i + 1}/${selectedLogTripFiles.length})...</span>`;
        const storedPath = await uploadTripImageFile(selectedLogTripFiles[i], newTrip.id);
        const { error: photoErr } = await supabase.from('trip_photos').insert([
          {
            trip_id: newTrip.id,
            image_path: storedPath,
          },
        ]);
        if (photoErr) console.warn('Photo insert notice:', photoErr.message);
      }
    }

    if (tempPickMarker) {
      map.removeLayer(tempPickMarker);
      tempPickMarker = null;
    }
    if (searchPinMarker) {
      map.removeLayer(searchPinMarker);
      searchPinMarker = null;
    }

    formLogTrip.reset();
    tripDate.valueAsDate = new Date();
    selectedLogTripFiles = [];
    renderLogTripPhotosPreview();

    closeLogTripModal();
    showToast(`ปักหมุดทริป "${title}" พร้อมรูปภาพลงบนแผนที่สำเร็จ! 🏍️📸`);

    await fetchSupabaseTrips();
    map.flyTo([latitude, longitude], 11, { duration: 1.2 });
  } catch (err) {
    showToast(`บันทึกทริปไม่สำเร็จ: ${err.message}`, 'error');
  } finally {
    btnSubmitLogTrip.disabled = false;
    btnSubmitLogTrip.innerHTML =
      '<i class="ph-bold ph-check-circle text-lg"></i><span>ปักหมุดและบันทึกทริปลงแผนที่</span>';
  }
});

// ============================================================
// 11. Garage & Supabase Authentication Modal (Phase 1)
// ============================================================
function openGarageModal() {
  garageModal.classList.remove('hidden');
}

function closeGarageModal() {
  garageModal.classList.add('hidden');
}

btnOpenGarage.addEventListener('click', openGarageModal);
btnCloseGarage.addEventListener('click', closeGarageModal);
garageBackdrop.addEventListener('click', closeGarageModal);

btnGarageNewTrip.addEventListener('click', () => {
  closeGarageModal();
  openLogTripModal();
});

btnResetMapView.addEventListener('click', (e) => {
  e.preventDefault();
  map.flyTo([15.87, 100.9925], 6, { duration: 1 });
});

function switchAuthTab(mode) {
  if (mode === 'login') {
    tabLoginBtn.className = 'py-2 text-xs font-bold rounded-lg bg-brand-500 text-zinc-950 transition';
    tabRegisterBtn.className =
      'py-2 text-xs font-bold rounded-lg text-zinc-400 hover:text-white transition';
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  } else {
    tabRegisterBtn.className =
      'py-2 text-xs font-bold rounded-lg bg-brand-500 text-zinc-950 transition';
    tabLoginBtn.className =
      'py-2 text-xs font-bold rounded-lg text-zinc-400 hover:text-white transition';
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  }
}

tabLoginBtn.addEventListener('click', () => switchAuthTab('login'));
tabRegisterBtn.addEventListener('click', () => switchAuthTab('register'));

async function ensureAndLoadProfile(user) {
  const localExtra = getLocalProfileExtra();
  const fallbackUsername =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.username ||
    localExtra.username ||
    user.email?.split('@')[0] ||
    'Rider';
  const fallbackBike =
    user.user_metadata?.bike_model || localExtra.bike_model || 'Biker Motorcycle';
  const fallbackAvatar =
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    localExtra.avatar_url ||
    '';
  const fallbackLinks = user.user_metadata?.social_links || localExtra.social_links || [];

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, username, bike_model, avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile && !error) {
      const { data: inserted } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: fallbackUsername,
          bike_model: fallbackBike,
          avatar_url: fallbackAvatar,
        })
        .select()
        .maybeSingle();
      if (inserted) {
        return {
          ...inserted,
          avatar_url: inserted.avatar_url || fallbackAvatar,
          social_links: fallbackLinks,
        };
      }
    }

    if (profile) {
      return {
        ...profile,
        avatar_url: profile.avatar_url || fallbackAvatar,
        social_links: fallbackLinks,
      };
    }

    return {
      username: fallbackUsername,
      bike_model: fallbackBike,
      avatar_url: fallbackAvatar,
      social_links: fallbackLinks,
    };
  } catch {
    return {
      username: fallbackUsername,
      bike_model: fallbackBike,
      avatar_url: fallbackAvatar,
      social_links: fallbackLinks,
    };
  }
}

function renderGarageTripsList() {
  if (!garageTripsList) return;
  const myTrips = userTrips.filter((trip) => currentUser && trip.user_id === currentUser.id);
  garageTripCount.textContent = String(myTrips.length);
  garageTripsList.innerHTML = '';

  if (myTrips.length === 0) {
    garageTripsList.innerHTML = `
      <div class="text-center py-6 text-zinc-500 text-xs">
        <i class="ph ph-map-pin text-2xl mb-1 text-zinc-600 block"></i>
        ยังไม่มีทริปที่คุณบันทึกไว้<br/>กดปุ่ม "+ เพิ่มทริปใหม่" เพื่อปักหมุดทริปแรกของคุณ
      </div>
    `;
    return;
  }

  myTrips.forEach((trip) => {
    const item = document.createElement('div');
    item.className =
      'flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-brand-500/60 cursor-pointer transition';
    item.innerHTML = `
      <div class="flex items-center gap-3 overflow-hidden">
        <img src="${trip.img}" alt="${trip.title}" class="w-10 h-10 rounded-full object-cover border border-brand-500 shrink-0" />
        <div class="overflow-hidden">
          <h5 class="text-sm font-bold text-white truncate">${trip.title}</h5>
          <p class="text-xs text-zinc-500">${trip.date} ${trip.isDemo ? '• ตัวอย่าง' : '• ทริปของคุณ'}</p>
        </div>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        ${
          !trip.isDemo && currentUser
            ? `
          <button type="button" class="btn-garage-edit-trip p-1.5 text-zinc-400 hover:text-brand-400 transition" title="แก้ไขทริป">
            <i class="ph ph-pencil-simple text-sm"></i>
          </button>
          <button type="button" class="btn-garage-del-trip p-1.5 text-zinc-400 hover:text-red-400 transition" title="ลบทริป">
            <i class="ph ph-trash text-sm"></i>
          </button>
        `
            : ''
        }
        <i class="ph-bold ph-caret-right text-brand-500 ml-1"></i>
      </div>
    `;

    const btnEdit = item.querySelector('.btn-garage-edit-trip');
    if (btnEdit) {
      btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        closeGarageModal();
        openEditTripModal(trip);
      });
    }

    const btnDel = item.querySelector('.btn-garage-del-trip');
    if (btnDel) {
      btnDel.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(`ต้องการลบทริป "${trip.title}" ใช่หรือไม่?`)) return;
        try {
          const { error } = await supabase
            .from('trips')
            .delete()
            .eq('id', trip.id)
            .eq('user_id', currentUser.id);
          if (error) throw error;
          showToast(`ลบทริป "${trip.title}" เรียบร้อยแล้ว`);
          await fetchSupabaseTrips();
        } catch (err) {
          showToast(`ลบทริปไม่สำเร็จ: ${err.message}`, 'error');
        }
      });
    }
    item.addEventListener('click', () => {
      closeGarageModal();
      map.flyTo([trip.lat, trip.lng], 11, { duration: 1 });
      openDetailModal(trip);
    });
    garageTripsList.appendChild(item);
  });
}

async function updateAuthUI(session) {
  currentUser = session?.user || null;

  if (currentUser) {
    authContainer.classList.add('hidden');
    garageProfileContainer.classList.remove('hidden');

    const profile = await ensureAndLoadProfile(currentUser);
    currentUserProfile = profile;
    populateProfileUIEverywhere();

    await fetchSupabaseTrips();
    await fetchUserNotifications();
  } else {
    currentUserProfile = null;
    authContainer.classList.remove('hidden');
    garageProfileContainer.classList.add('hidden');
    navGarageLabel.textContent = 'Garage';
    populateProfileUIEverywhere();
    renderGarageTripsList();
    await fetchSupabaseTrips();
    fetchUserNotifications();
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  btnLoginSubmit.disabled = true;
  btnLoginSubmit.textContent = 'กำลังเข้าสู่ระบบ...';

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    loginForm.reset();
    showToast('เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับสู่ RideMap 🏍️');
  } catch (err) {
    showToast(`เข้าสู่ระบบไม่สำเร็จ: ${err.message}`, 'error');
  } finally {
    btnLoginSubmit.disabled = false;
    btnLoginSubmit.textContent = 'เข้าสู่ระบบ';
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('regUsername').value.trim();
  const bikeModel = document.getElementById('regBike').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;

  btnRegSubmit.disabled = true;
  btnRegSubmit.textContent = 'กำลังสร้างบัญชี...';

  try {
    saveLocalProfileExtra({
      username,
      bike_model: bikeModel,
      avatar_url: '',
      social_links: [],
    });

    const redirectUrl = window.location.origin + window.location.pathname;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username,
          bike_model: bikeModel,
        },
      },
    });
    if (error) throw error;

    if (data.session) {
      await ensureAndLoadProfile(data.user);
      registerForm.reset();
      showToast('สมัครสมาชิกและเข้าสู่ระบบสำเร็จ!');
    } else {
      registerForm.reset();
      switchAuthTab('login');
      showToast('สมัครสมาชิกสำเร็จ! กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ');
    }
  } catch (err) {
    showToast(`สมัครสมาชิกไม่สำเร็จ: ${err.message}`, 'error');
  } finally {
    btnRegSubmit.disabled = false;
    btnRegSubmit.textContent = 'สร้างบัญชีนักบิด';
  }
});

btnLogout.addEventListener('click', async () => {
  await supabase.auth.signOut();
  showToast('ออกจากระบบเรียบร้อยแล้ว');
});

// เข้าสู่ระบบด้วยบัญชี Google (ขอสิทธิ์ Google OAuth)
async function handleGoogleSignIn() {
  try {
    showToast('กำลังเชื่อมต่อไปยัง Google เพื่อขอสิทธิ์เข้าสู่ระบบ...');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  } catch (err) {
    if (googleSetupNotice) {
      googleSetupNotice.classList.remove('hidden');
    }
    showToast('ระบบ Google Login ยังไม่ได้เปิดใน Supabase Dashboard (ดูคำแนะนำด้านล่าง)', 'error');
  }
}

if (btnGoogleSignIn) {
  btnGoogleSignIn.addEventListener('click', handleGoogleSignIn);
}

if (btnSideGoogleLogin) {
  btnSideGoogleLogin.addEventListener('click', () => {
    closeSidebar();
    handleGoogleSignIn();
  });
}

// ============================================================
// 12. Initialize App
// ============================================================
async function initApp() {
  initSidebarSettingsUI();
  initSidebarFeedbackUI();
  renderOwnerContactFooter();
  populateProfileUIEverywhere();

  // ดึงทริปสาธารณะทั้งหมดของชุมชนขึ้นบนแผนที่ทันที (ทุกคนมองเห็นร่วมกัน)
  await fetchSupabaseTrips();

  const { data } = await supabase.auth.getSession();
  await updateAuthUI(data?.session || null);

  supabase.auth.onAuthStateChange((_event, session) => {
    updateAuthUI(session);
  });

  // ป้องกันการแจ้งเตือน Real-time เด้งซ้ำซ้อนภายในระยะเวลาใกล้เคียงกัน
  const recentNotifToasts = new Set();

  // ติดตามการเพิ่มทริป, คอมเมนต์ และการแจ้งเตือนแบบ Real-time
  try {
    supabase
      .channel('public:realtime_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
        fetchSupabaseTrips();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_reactions' }, (payload) => {
        const affectedTripId = payload.new?.trip_id || payload.old?.trip_id;
        if (activeModalTrip && activeModalTrip.id === affectedTripId) {
          renderReactionsUI(activeModalTrip);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trip_comments' }, (payload) => {
        if (activeModalTrip && activeModalTrip.id === payload.new?.trip_id) {
          renderCommentsUI(activeModalTrip);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        if (currentUser && payload.new?.user_id === currentUser.id) {
          const notifKey = payload.new.comment_id
            ? `cm-${payload.new.comment_id}`
            : `${payload.new.trip_id}-${payload.new.actor_id}-${payload.new.message}`;

          if (!recentNotifToasts.has(notifKey)) {
            recentNotifToasts.add(notifKey);
            setTimeout(() => recentNotifToasts.delete(notifKey), 4000);
            showToast(`🔔 ${payload.new.message}`, 'info');
          }
          fetchUserNotifications();
        }
      })
      .subscribe();
  } catch (err) {
    console.warn('Realtime channel error:', err);
  }
}

initApp();
