// MoveClub Single Page Application Logic

const app = {
  // State
  state: {
    user: null,
    studios: [],
    classes: [],
    categories: [],
    bookings: [],
    favorites: [],
    activeView: 'explore',
    viewMode: 'grid', // 'grid' | 'map'
    bookingsTab: 'active', // 'active' | 'past'
    selectedClassForBooking: null,
    selectedBookingForReview: null,
    reviewRating: 5,
    filters: {
      city: 'Osorno',
      date: '',
      category: 'all',
      time_of_day: 'all',
      max_credits: '',
      search: ''
    }
  },

  map: null,
  mapMarkers: [],

  // Initialization
  async init() {
    this.initDateCarousel();
    await this.fetchUser();
    await this.fetchCategories();
    await this.fetchStudios();
    await this.fetchClasses();
    this.setupEventListeners();
    lucide.createIcons();

    // Register PWA Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration:', err));
    }

    this.checkWelcomeModal();
  },

  checkWelcomeModal() {
    const modal = document.getElementById('welcomeTrialModal');
    if (!modal) return;
    if (!localStorage.getItem('moveclub_welcomed_v2')) {
      setTimeout(() => {
        modal.classList.remove('hidden');
        lucide.createIcons();
      }, 600);
    }
  },

  closeWelcomeModal() {
    const modal = document.getElementById('welcomeTrialModal');
    if (modal) modal.classList.add('hidden');
    localStorage.setItem('moveclub_welcomed_v2', 'true');
    this.showToast('🎁 ¡25 Créditos de Bienvenida listos en tu cuenta!');
  },

  claimFreeTrial() {
    this.switchView('explore');
    this.showToast('🎁 ¡Tu Prueba Gratuita de 25 créditos está activa! Elige tu primera clase.');
  },

  // Setup Date Carousel
  initDateCarousel() {
    const carousel = document.getElementById('dateCarousel');
    if (!carousel) return;
    carousel.innerHTML = '';

    const today = new Date();
    const daysNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const monthsNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    for (let i = 0; i < 5; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const isoDate = `${year}-${month}-${day}`;

      let labelTop = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : daysNames[d.getDay()];
      let labelSub = `${d.getDate()} ${monthsNames[d.getMonth()]}`;

      const pill = document.createElement('div');
      pill.className = `date-pill px-4 py-2 rounded-2xl border text-center shrink-0 ${i === 0 ? 'active' : 'bg-white border-slate-200 text-slate-700'}`;
      pill.dataset.date = isoDate;
      pill.onclick = () => this.handleDateSelect(isoDate, pill, i === 0 ? 'Hoy' : `${labelTop} ${labelSub}`);

      pill.innerHTML = `
        <span class="block text-[11px] font-semibold uppercase tracking-wider">${labelTop}</span>
        <span class="block text-sm font-extrabold">${labelSub}</span>
      `;

      carousel.appendChild(pill);

      if (i === 0) {
        this.state.filters.date = isoDate;
      }
    }
  },

  handleDateSelect(isoDate, element, labelText) {
    document.querySelectorAll('.date-pill').forEach(p => {
      p.classList.remove('active');
      p.classList.add('bg-white', 'border-slate-200', 'text-slate-700');
    });
    element.classList.add('active');
    element.classList.remove('bg-white', 'border-slate-200', 'text-slate-700');

    this.state.filters.date = isoDate;
    document.getElementById('selectedDateLabel').innerText = labelText;
    this.fetchClasses();
  },

  // View Navigation
  switchView(viewName) {
    this.state.activeView = viewName;

    // Hide all view sections
    const sections = ['explore', 'bookings', 'plans', 'favorites', 'admin'];
    sections.forEach(s => {
      const el = document.getElementById(`view-${s}`);
      const navEl = document.getElementById(`nav-${s}`);
      if (el) el.classList.add('hidden');
      if (navEl) navEl.classList.remove('active');
    });

    // Show target section
    const targetSection = document.getElementById(`view-${viewName}`);
    const targetNav = document.getElementById(`nav-${viewName}`);
    if (targetSection) targetSection.classList.remove('hidden');
    if (targetNav) targetNav.classList.add('active');

    // Trigger specific view loaders
    if (viewName === 'bookings') {
      this.fetchBookings();
    } else if (viewName === 'favorites') {
      this.fetchFavorites();
    } else if (viewName === 'plans') {
      this.renderPlansView();
    } else if (viewName === 'admin') {
      this.renderAdminView();
    } else if (viewName === 'explore' && this.state.viewMode === 'map') {
      setTimeout(() => this.initOrUpdateMap(), 100);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    lucide.createIcons();
  },

  // Switch explore mode between Grid and Leaflet Map
  setExploreViewMode(mode) {
    this.state.viewMode = mode;
    const gridContainer = document.getElementById('classesGridContainer');
    const mapContainer = document.getElementById('mapViewContainer');
    const gridBtn = document.getElementById('viewGridBtn');
    const mapBtn = document.getElementById('viewMapBtn');

    if (mode === 'grid') {
      gridContainer.classList.remove('hidden');
      mapContainer.classList.add('hidden');
      gridBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 bg-white text-slate-900 shadow-sm";
      mapBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 text-slate-600 hover:text-slate-900";
    } else {
      gridContainer.classList.add('hidden');
      mapContainer.classList.remove('hidden');
      mapBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 bg-white text-slate-900 shadow-sm";
      gridBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 text-slate-600 hover:text-slate-900";
      setTimeout(() => this.initOrUpdateMap(), 100);
    }
  },

  // API: Fetch User
  async fetchUser() {
    try {
      const res = await fetch('/api/user');
      const data = await res.json();
      if (data.success) {
        this.state.user = data.user;
        this.renderUser();
      }
    } catch (err) {
      console.error("Error fetching user:", err);
    }
  },

  renderUser() {
    const u = this.state.user;
    if (!u) return;

    // Credits pill in navbar
    const creditsEl = document.getElementById('userCreditsDisplay');
    if (creditsEl) creditsEl.innerText = `${u.credits_balance} créditos`;

    // Dropdown details
    document.getElementById('dropdownUserName').innerText = u.name;
    document.getElementById('dropdownUserEmail').innerText = u.email;
    document.getElementById('dropdownUserPlan').innerText = u.plan_tier;
    if (u.avatar_url) {
      document.getElementById('userAvatarImg').src = u.avatar_url;
    }

    // Plans view metrics
    const planBadge = document.getElementById('userPlanBadgeText');
    if (planBadge) planBadge.innerText = `${u.plan_tier} Activo`;

    const plansBalance = document.getElementById('plansBalanceNum');
    if (plansBalance) plansBalance.innerText = u.credits_balance;

    const approxClasses = document.getElementById('approxClassesNum');
    if (approxClasses) approxClasses.innerText = `~${Math.floor(u.credits_balance / 5)} clases`;
  },

  // API: Fetch Categories
  async fetchCategories() {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (data.success) {
        this.state.categories = data.categories;
        this.renderCategoryPills();
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  },

  renderCategoryPills() {
    const container = document.getElementById('categoryPills');
    if (!container) return;

    const iconsMap = {
      'all': 'sparkles',
      'Yoga': 'heart-handshake',
      'Spinning': 'bike',
      'CrossFit': 'flame',
      'Pilates': 'activity',
      'Boxeo': 'shield',
      'Spa & Bienestar': 'sparkles',
      'HIIT': 'zap',
      'Natación': 'waves'
    };

    let html = `
      <button onclick="app.handleCategoryFilter('all', this)" class="category-pill active px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 shrink-0">
        <span>✨ Todas</span>
      </button>
    `;

    this.state.categories.forEach(cat => {
      html += `
        <button onclick="app.handleCategoryFilter('${cat.category}', this)" class="category-pill px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 flex items-center space-x-1.5 shrink-0">
          <span>${cat.category}</span>
          <span class="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full font-semibold">${cat.classes_count}</span>
        </button>
      `;
    });

    container.innerHTML = html;
  },

  handleCityChange(city) {
    this.state.filters.city = city;
    this.fetchStudios();
    this.fetchClasses();
    if (this.state.viewMode === 'map') {
      setTimeout(() => this.initOrUpdateMap(), 100);
    }
  },

  handleCategoryFilter(category, btnElement) {
    document.querySelectorAll('.category-pill').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');
    this.state.filters.category = category;
    this.fetchClasses();
  },

  handleTimeFilter(timeVal) {
    this.state.filters.time_of_day = timeVal;
    this.fetchClasses();
  },

  handleCreditsFilter(creditsVal) {
    this.state.filters.max_credits = creditsVal;
    this.fetchClasses();
  },

  handleSearch(query) {
    this.state.filters.search = query.trim();
    clearTimeout(this._searchTimeout);
    this._searchTimeout = setTimeout(() => {
      this.fetchClasses();
    }, 250);
  },

  resetFilters() {
    this.state.filters = {
      city: this.state.filters.city,
      date: this.state.filters.date,
      category: 'all',
      time_of_day: 'all',
      max_credits: '',
      search: ''
    };
    document.getElementById('searchInput').value = '';
    document.getElementById('timeFilter').value = 'all';
    document.getElementById('creditsFilter').value = '';
    document.querySelectorAll('.category-pill').forEach((b, idx) => {
      if (idx === 0) b.classList.add('active');
      else b.classList.remove('active');
    });
    this.fetchClasses();
  },

  // API: Fetch Studios
  async fetchStudios() {
    try {
      const cityParam = this.state.filters.city ? `?city=${encodeURIComponent(this.state.filters.city)}` : '';
      const res = await fetch(`/api/studios${cityParam}`);
      const data = await res.json();
      if (data.success) {
        this.state.studios = data.studios;
        if (this.state.viewMode === 'map') {
          this.initOrUpdateMap();
        }
      }
    } catch (err) {
      console.error("Error fetching studios:", err);
    }
  },

  // API: Fetch Classes
  async fetchClasses() {
    const f = this.state.filters;
    const params = new URLSearchParams();
    if (f.city) params.append('city', f.city);
    if (f.date) params.append('date', f.date);
    if (f.category && f.category !== 'all') params.append('category', f.category);
    if (f.time_of_day && f.time_of_day !== 'all') params.append('time_of_day', f.time_of_day);
    if (f.max_credits) params.append('max_credits', f.max_credits);
    if (f.search) params.append('search', f.search);

    try {
      const res = await fetch(`/api/classes?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        this.state.classes = data.classes;
        this.renderClasses();
      }
    } catch (err) {
      console.error("Error fetching classes:", err);
    }
  },

  renderClasses() {
    const grid = document.getElementById('classesGrid');
    const noResults = document.getElementById('noResultsState');
    const countEl = document.getElementById('resultsCount');

    if (!grid) return;

    const list = this.state.classes;
    if (countEl) {
      countEl.innerText = `${list.length} clases encontradas`;
    }

    if (list.length === 0) {
      grid.innerHTML = '';
      noResults.classList.remove('hidden');
      return;
    }

    noResults.classList.add('hidden');

    grid.innerHTML = list.map(c => {
      const timeParts = c.start_time.split(' ');
      const hourStr = timeParts[1] || '08:00';
      const isUrgent = c.available_spots <= 3;

      return `
        <div class="fitpass-card bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <!-- Studio Photo & Category Badge -->
          <div class="relative h-44 overflow-hidden group">
            <img src="${c.studio_image}" alt="${c.studio_name}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent"></div>
            
            <!-- Category Tag -->
            <span class="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-white/90 text-slate-900 backdrop-blur-md shadow-sm">
              ${c.category}
            </span>

            <!-- Credits Pill Overlay -->
            <span class="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-black bg-teal-600 text-white shadow-md flex items-center space-x-1">
              <i data-lucide="coins" class="w-3.5 h-3.5 mr-1"></i>
              ${c.credit_cost} créditos
            </span>

            <!-- Studio Name & Rating on bottom of image -->
            <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
              <div>
                <span class="text-xs text-indigo-300 font-semibold block">${c.neighborhood || 'Santiago'}</span>
                <h4 class="font-bold text-sm leading-tight text-white drop-shadow-sm cursor-pointer hover:underline" onclick="app.openStudioModal(${c.studio_id})">
                  ${c.studio_name}
                </h4>
              </div>
              <div class="flex items-center space-x-1 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-lg text-xs font-bold text-amber-300 border border-white/10">
                <span>★</span>
                <span>${c.studio_rating || '4.9'}</span>
              </div>
            </div>
          </div>

          <!-- Class Details Body -->
          <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span class="flex items-center text-indigo-600 font-bold">
                  <i data-lucide="clock" class="w-3.5 h-3.5 mr-1"></i>
                  ${hourStr} hrs (${c.duration_minutes} min)
                </span>
                <span class="bg-slate-100 px-2 py-0.5 rounded-md text-[11px] text-slate-600">${c.level}</span>
              </div>

              <h3 class="font-extrabold text-base text-slate-900 line-clamp-1">${c.title}</h3>
              <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed">${c.description || 'Entrenamiento enfocado en tonificación, resistencia y movilidad guiado por instructores profesionales.'}</p>
            </div>

            <!-- Instructor & Spots status -->
            <div class="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div class="flex items-center space-x-2.5">
                <img src="${c.instructor_avatar}" alt="${c.instructor_name}" class="w-7 h-7 rounded-full object-cover border border-slate-200">
                <div>
                  <span class="block text-xs font-bold text-slate-800 leading-tight">${c.instructor_name}</span>
                  <span class="block text-[10px] text-slate-400">Instructor Lead</span>
                </div>
              </div>

              <div>
                ${isUrgent ? `
                  <span class="spot-pulse inline-flex items-center text-[11px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
                    🔥 ¡Solo ${c.available_spots} cupos!
                  </span>
                ` : `
                  <span class="text-[11px] font-semibold text-slate-500">
                    ${c.available_spots} cupos libres
                  </span>
                `}
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="pt-1 flex space-x-2">
              <button onclick="app.openStudioModal(${c.studio_id})" class="w-1/3 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition">
                Estudio
              </button>
              <button onclick="app.openBookingModal(${c.id})" class="w-2/3 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-extrabold hover:bg-indigo-700 transition shadow-sm shadow-indigo-200 flex items-center justify-center space-x-1.5">
                <i data-lucide="ticket" class="w-3.5 h-3.5"></i>
                <span>Reservar (${c.credit_cost} cr)</span>
              </button>
            </div>

          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  },

  // Leaflet Map Initialization and Pin Rendering
  initOrUpdateMap() {
    const cityCoordinates = {
      'Osorno': { center: [-40.575, -73.13], zoom: 14 },
      'Temuco': { center: [-38.74, -72.61], zoom: 14 },
      'Santiago': { center: [-33.425, -70.605], zoom: 13 },
      'Puerto Varas': { center: [-41.32, -72.98], zoom: 14 },
      'all': { center: [-36.5, -71.5], zoom: 6 }
    };

    const currentCity = this.state.filters.city || 'Osorno';
    const config = cityCoordinates[currentCity] || cityCoordinates['Osorno'];

    if (!this.map) {
      this.map = L.map('mapContainer').setView(config.center, config.zoom);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19
      }).addTo(this.map);
    } else {
      this.map.setView(config.center, config.zoom);
      this.map.invalidateSize();
    }

    // Clear existing markers
    this.mapMarkers.forEach(m => this.map.removeLayer(m));
    this.mapMarkers = [];

    // Add markers for all studios
    this.state.studios.forEach(s => {
      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="background: #4f46e5; color: white; padding: 6px 10px; border-radius: 9999px; font-weight: 800; font-size: 11px; box-shadow: 0 4px 14px rgba(79,70,229,0.4); border: 2px solid white; display: flex; align-items: center; gap: 4px;">
            <span>★ ${s.rating}</span>
          </div>
        `,
        iconSize: [60, 30],
        iconAnchor: [30, 15]
      });

      const marker = L.marker([s.latitude, s.longitude], { icon: customIcon }).addTo(this.map);
      
      const popupContent = `
        <div style="font-family: inherit; width: 220px;">
          <img src="${s.image_url}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 8px; margin-bottom: 6px;">
          <h4 style="font-weight: 800; font-size: 14px; margin-bottom: 2px; color: #0f172a;">${s.name}</h4>
          <p style="font-size: 11px; color: #64748b; margin-bottom: 6px;">${s.neighborhood} • ${s.category}</p>
          <button onclick="app.openStudioModal(${s.id})" style="width: 100%; background: #4f46e5; color: white; border: none; padding: 6px; border-radius: 8px; font-weight: 700; font-size: 11px; cursor: pointer;">
            Ver Clases y Horarios
          </button>
        </div>
      `;
      marker.bindPopup(popupContent);
      this.mapMarkers.push(marker);
    });
  },

  // Studio Detail Modal
  async openStudioModal(studioId) {
    try {
      const res = await fetch(`/api/studios/${studioId}`);
      const data = await res.json();
      if (!data.success) return;

      const s = data.studio;
      const modal = document.getElementById('studioDetailModal');
      const content = document.getElementById('studioDetailContent');

      const amenitiesList = s.amenities.split(',').map(a => `
        <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
          <i data-lucide="check" class="w-3 h-3 text-teal-600 mr-1"></i>
          ${a.trim()}
        </span>
      `).join('');

      const classesHtml = s.classes.map(c => `
        <div class="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50 flex items-center justify-between hover:bg-slate-100/80 transition">
          <div class="space-y-0.5">
            <span class="text-xs font-bold text-indigo-600">${c.start_time} (${c.duration_minutes} min)</span>
            <h4 class="font-bold text-sm text-slate-900">${c.title}</h4>
            <span class="text-xs text-slate-500">Instructor: ${c.instructor_name} • ${c.available_spots} cupos</span>
          </div>
          <button onclick="app.closeStudioModal(); app.openBookingModal(${c.id})" class="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition shadow-sm">
            Reservar (${c.credit_cost} cr)
          </button>
        </div>
      `).join('');

      content.innerHTML = `
        <div class="relative h-56 overflow-hidden">
          <img src="${s.image_url}" class="w-full h-full object-cover">
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
          <button onclick="app.closeStudioModal()" class="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-900/60 text-white flex items-center justify-center backdrop-blur-md">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
          
          <div class="absolute bottom-4 left-6 right-6 text-white flex items-end justify-between">
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-indigo-300">${s.category} • ${s.neighborhood}</span>
              <h2 class="text-2xl font-black">${s.name}</h2>
              <p class="text-xs text-slate-300">${s.address}</p>
            </div>
            <button onclick="app.toggleFavorite(${s.id})" class="p-2.5 rounded-full ${s.is_favorite ? 'bg-rose-500 text-white' : 'bg-white/20 text-white'} backdrop-blur-md">
              <i data-lucide="heart" class="w-5 h-5 ${s.is_favorite ? 'fill-current' : ''}"></i>
            </button>
          </div>
        </div>

        <div class="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <!-- About -->
          <div class="space-y-2">
            <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Sobre el Estudio</h4>
            <p class="text-xs text-slate-600 leading-relaxed">${s.description}</p>
          </div>

          <!-- Amenities -->
          <div class="space-y-2">
            <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Servicios y Comodidades</h4>
            <div class="flex flex-wrap gap-2">
              ${amenitiesList}
            </div>
          </div>

          <!-- Classes schedule -->
          <div class="space-y-3">
            <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Próximas Clases Disponibles</h4>
            <div class="space-y-2">
              ${classesHtml.length > 0 ? classesHtml : '<p class="text-xs text-slate-400 italic">No hay clases programadas para los próximos días.</p>'}
            </div>
          </div>
        </div>
      `;

      modal.classList.remove('hidden');
      lucide.createIcons();

    } catch (err) {
      console.error("Error opening studio modal:", err);
    }
  },

  closeStudioModal() {
    document.getElementById('studioDetailModal').classList.add('hidden');
  },

  // Toggle Favorite Studio
  async toggleFavorite(studioId) {
    try {
      const res = await fetch('/api/favorites/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studio_id: studioId })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, data.is_favorite ? 'heart' : 'info');
        this.fetchStudios();
        if (this.state.activeView === 'favorites') this.fetchFavorites();
      }
    } catch (err) {
      console.error(err);
    }
  },

  // Booking Flow: Open Modal
  openBookingModal(classId) {
    const cls = this.state.classes.find(c => c.id === classId);
    if (!cls) return;

    this.state.selectedClassForBooking = cls;
    const user = this.state.user;

    const modal = document.getElementById('bookingModal');
    const content = document.getElementById('bookingModalContent');

    content.innerHTML = `
      <div class="flex items-center space-x-4 p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100">
        <img src="${cls.studio_image}" class="w-14 h-14 rounded-xl object-cover">
        <div>
          <span class="text-xs font-bold uppercase text-indigo-600">${cls.category}</span>
          <h4 class="font-extrabold text-sm text-slate-900">${cls.title}</h4>
          <p class="text-xs text-slate-500">${cls.studio_name} • ${cls.neighborhood}</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 text-xs">
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <span class="text-slate-400 block font-semibold">Horario</span>
          <span class="font-bold text-slate-800">${cls.start_time}</span>
        </div>
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <span class="text-slate-400 block font-semibold">Instructor</span>
          <span class="font-bold text-slate-800">${cls.instructor_name}</span>
        </div>
      </div>
    `;

    document.getElementById('modalCurrentBalance').innerText = `${user.credits_balance} créditos`;
    document.getElementById('modalClassCost').innerText = `-${cls.credit_cost} créditos`;
    
    const remaining = user.credits_balance - cls.credit_cost;
    const remEl = document.getElementById('modalRemainingBalance');
    if (remaining >= 0) {
      remEl.innerText = `${remaining} créditos`;
      remEl.className = "font-bold text-teal-700";
      document.getElementById('confirmBookingBtn').disabled = false;
      document.getElementById('confirmBookingBtn').classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
      remEl.innerText = `Insuficiente (${remaining} créditos)`;
      remEl.className = "font-bold text-rose-600";
      document.getElementById('confirmBookingBtn').disabled = true;
      document.getElementById('confirmBookingBtn').classList.add('opacity-50', 'cursor-not-allowed');
    }

    modal.classList.remove('hidden');
    lucide.createIcons();
  },

  closeBookingModal() {
    document.getElementById('bookingModal').classList.add('hidden');
  },

  // Confirm Reservation
  async confirmBooking() {
    const cls = this.state.selectedClassForBooking;
    if (!cls) return;

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_id: cls.id })
      });

      const data = await res.json();
      if (data.success) {
        this.closeBookingModal();
        this.showToast("¡Reserva confirmada con éxito!", "check");
        await this.fetchUser();
        await this.fetchClasses();
        // Show Digital QR Pass right away
        this.openQrModal(data.qr_code, cls);
      } else {
        this.showToast(data.error || "Error al realizar la reserva", "alert-circle");
      }
    } catch (err) {
      this.showToast("Error de conexión al servidor", "alert-circle");
    }
  },

  // QR Modal
  openQrModal(qrCodeId, classDetails) {
    const modal = document.getElementById('qrModal');
    const content = document.getElementById('qrModalContent');

    content.innerHTML = `
      <div class="space-y-1">
        <span class="text-xs uppercase font-bold text-indigo-400">Pase Digital de Acceso</span>
        <h3 class="text-xl font-black text-white">${classDetails.title || classDetails.class_title}</h3>
        <p class="text-xs text-slate-300">${classDetails.studio_name} • ${classDetails.studio_address || classDetails.address}</p>
      </div>

      <div class="p-4 bg-white rounded-2xl inline-block shadow-inner mx-auto my-2">
        <div id="qrcodeCanvas"></div>
      </div>

      <div class="space-y-1">
        <p class="font-mono text-xs font-bold text-indigo-300">${qrCodeId}</p>
        <p class="text-xs text-slate-300 font-semibold">Horario: ${classDetails.start_time}</p>
        <p class="text-xs text-slate-400">Titular: ${this.state.user.name}</p>
      </div>
    `;

    modal.classList.remove('hidden');
    lucide.createIcons();

    // Generate QR Code via library
    setTimeout(() => {
      const container = document.getElementById('qrcodeCanvas');
      if (container) {
        container.innerHTML = '';
        new QRCode(container, {
          text: `MOVECLUB:${qrCodeId}:USER1`,
          width: 140,
          height: 140,
          colorDark: "#0f172a",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.H
        });
      }
    }, 50);
  },

  closeQrModal() {
    document.getElementById('qrModal').classList.add('hidden');
  },

  // API: Fetch Bookings
  async fetchBookings() {
    try {
      const res = await fetch('/api/bookings');
      const data = await res.json();
      if (data.success) {
        this.state.bookings = data.bookings;
        this.renderBookings();
      }
    } catch (err) {
      console.error(err);
    }
  },

  setBookingsTab(tab) {
    this.state.bookingsTab = tab;
    const btnActive = document.getElementById('btnTabActiveBookings');
    const btnPast = document.getElementById('btnTabPastBookings');

    if (tab === 'active') {
      btnActive.className = "px-4 py-2 rounded-lg text-xs font-bold bg-white text-slate-900 shadow-sm transition";
      btnPast.className = "px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition";
    } else {
      btnPast.className = "px-4 py-2 rounded-lg text-xs font-bold bg-white text-slate-900 shadow-sm transition";
      btnActive.className = "px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition";
    }

    this.renderBookings();
  },

  renderBookings() {
    const list = document.getElementById('bookingsList');
    const noBookings = document.getElementById('noBookingsState');
    const badge = document.getElementById('activeBookingsBadge');

    const activeList = this.state.bookings.filter(b => b.status === 'confirmed');
    const pastList = this.state.bookings.filter(b => b.status !== 'confirmed');

    if (badge) {
      if (activeList.length > 0) {
        badge.innerText = activeList.length;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    const currentList = this.state.bookingsTab === 'active' ? activeList : pastList;

    if (currentList.length === 0) {
      list.innerHTML = '';
      noBookings.classList.remove('hidden');
      return;
    }

    noBookings.classList.add('hidden');

    list.innerHTML = currentList.map(b => {
      const isConfirmed = b.status === 'confirmed';

      return `
        <div class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition space-y-4">
          <div class="flex items-start justify-between">
            <div class="flex space-x-3.5">
              <img src="${b.studio_image}" class="w-14 h-14 rounded-2xl object-cover shadow-sm">
              <div>
                <span class="text-xs font-bold uppercase text-indigo-600 tracking-wider">${b.category}</span>
                <h4 class="font-extrabold text-base text-slate-900">${b.class_title}</h4>
                <p class="text-xs text-slate-500">${b.studio_name} • ${b.neighborhood}</p>
              </div>
            </div>

            <span class="px-2.5 py-1 rounded-full text-[11px] font-bold ${isConfirmed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}">
              ${isConfirmed ? '● Confirmada' : 'Cancelada'}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div>
              <span class="text-slate-400 block font-semibold">Fecha y Hora</span>
              <span class="font-bold text-slate-800">${b.start_time}</span>
            </div>
            <div>
              <span class="text-slate-400 block font-semibold">Instructor</span>
              <span class="font-bold text-slate-800">${b.instructor_name}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-between pt-1">
            ${isConfirmed ? `
              <button onclick="app.openQrModal('${b.qr_code_id}', ${JSON.stringify(b).replace(/"/g, '&quot;')})" class="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition flex items-center space-x-1.5 shadow-sm">
                <i data-lucide="qr-code" class="w-4 h-4"></i>
                <span>Ver Pase QR</span>
              </button>
              <button onclick="app.cancelBooking(${b.booking_id})" class="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50 transition">
                Cancelar Reserva
              </button>
            ` : `
              <div>
                ${b.rating ? `
                  <span class="text-xs text-amber-500 font-bold">Calificación: ${'★'.repeat(b.rating)}</span>
                ` : `
                  <button onclick="app.openReviewModal(${b.booking_id})" class="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition">
                    ★ Calificar Clase
                  </button>
                `}
              </div>
              <button onclick="app.openBookingModal(${b.class_id})" class="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition">
                Volver a Reservar
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  },

  // Cancel Booking
  async cancelBooking(bookingId) {
    if (!confirm("¿Estás seguro de cancelar esta reserva? Tus créditos serán reembolsados de inmediato.")) return;

    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, "check");
        await this.fetchUser();
        await this.fetchBookings();
        await this.fetchClasses();
      } else {
        this.showToast(data.error || "No se pudo cancelar", "alert-circle");
      }
    } catch (err) {
      console.error(err);
    }
  },

  // Review Modal
  openReviewModal(bookingId) {
    this.state.selectedBookingForReview = bookingId;
    this.state.reviewRating = 5;
    this.updateStarsUI(5);
    document.getElementById('reviewModal').classList.remove('hidden');
  },

  closeReviewModal() {
    document.getElementById('reviewModal').classList.add('hidden');
  },

  setRatingScore(score) {
    this.state.reviewRating = score;
    this.updateStarsUI(score);
  },

  updateStarsUI(score) {
    const btns = document.querySelectorAll('.star-btn');
    btns.forEach((btn, idx) => {
      btn.style.color = idx < score ? '#f59e0b' : '#cbd5e1';
    });
  },

  async submitReview() {
    const bookingId = this.state.selectedBookingForReview;
    const comment = document.getElementById('reviewCommentInput').value;

    try {
      const res = await fetch(`/api/bookings/${bookingId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: this.state.reviewRating, comment })
      });
      const data = await res.json();
      if (data.success) {
        this.closeReviewModal();
        this.showToast(data.message, "check");
        this.fetchBookings();
      }
    } catch (err) {
      console.error(err);
    }
  },

  // Payment Checkout Modal
  openPaymentModal(planName, credits, amountClp) {
    this.state.pendingPayment = {
      planName,
      credits,
      amountClp
    };

    document.getElementById('checkoutPlanName').innerText = planName;
    document.getElementById('checkoutCreditsNum').innerText = `+${credits} créditos`;
    document.getElementById('checkoutTotalAmount').innerText = `$${amountClp.toLocaleString('es-CL')} CLP`;

    document.getElementById('paymentModal').classList.remove('hidden');
    lucide.createIcons();
  },

  closePaymentModal() {
    document.getElementById('paymentModal').classList.add('hidden');
    this.state.pendingPayment = null;
  },

  async processPayment() {
    if (!this.state.pendingPayment) return;

    const { planName, credits, amountClp } = this.state.pendingPayment;
    const selectedRadio = document.querySelector('input[name="payment_method"]:checked');
    const method = selectedRadio ? selectedRadio.value : 'Transbank Webpay Plus';

    const payBtn = document.getElementById('payNowBtn');
    payBtn.disabled = true;
    payBtn.innerHTML = `<span class="animate-spin mr-2">⏳</span> Conectando con ${method}...`;

    try {
      // Step 1: Initiate checkout
      const checkRes = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_name: planName,
          credits: credits,
          amount_clp: amountClp,
          method: method
        })
      });
      const checkData = await checkRes.json();

      // Step 2: Simulate secure gateway confirmation
      await new Promise(r => setTimeout(r, 800));

      const confirmRes = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: checkData.order_id,
          auth_code: checkData.auth_code,
          plan_name: planName,
          credits: credits,
          amount_clp: amountClp,
          method: method
        })
      });
      const confirmData = await confirmRes.json();

      if (confirmData.success) {
        this.closePaymentModal();
        this.showToast(`¡Pago exitoso! Se acreditaron +${credits} créditos a tu cuenta`, "sparkles");
        await this.fetchUser();
        this.renderPlansView();
      } else {
        this.showToast("Error procesando el pago con la pasarela", "alert-circle");
      }
    } catch (err) {
      console.error("Payment error:", err);
      this.showToast("Error de conexión con la pasarela de pagos", "alert-circle");
    } finally {
      payBtn.disabled = false;
      payBtn.innerHTML = `<i data-lucide="lock" class="w-3.5 h-3.5"></i><span>Pagar Ahora de Forma Segura</span>`;
      lucide.createIcons();
    }
  },

  renderPlansView() {
    this.renderUser();
    const tbody = document.getElementById('transactionsTableBody');
    if (!tbody || !this.state.user || !this.state.user.transactions) return;

    tbody.innerHTML = this.state.user.transactions.map(t => {
      const isPositive = t.amount > 0;
      return `
        <tr class="hover:bg-slate-50 transition">
          <td class="py-2.5 font-bold text-slate-800">${t.description}</td>
          <td class="py-2.5">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isPositive ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700'}">
              ${t.type}
            </span>
          </td>
          <td class="py-2.5 text-slate-400">${t.created_at.split(' ')[0]}</td>
          <td class="py-2.5 text-right font-black ${isPositive ? 'text-teal-600' : 'text-slate-800'}">
            ${isPositive ? '+' : ''}${t.amount} cr
          </td>
        </tr>
      `;
    }).join('');
  },

  // Favorites View
  async fetchFavorites() {
    try {
      const res = await fetch('/api/favorites');
      const data = await res.json();
      if (data.success) {
        this.state.favorites = data.favorites;
        this.renderFavorites();
      }
    } catch (err) {
      console.error(err);
    }
  },

  renderFavorites() {
    const grid = document.getElementById('favoritesGrid');
    const empty = document.getElementById('noFavoritesState');
    if (!grid) return;

    if (this.state.favorites.length === 0) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');

    grid.innerHTML = this.state.favorites.map(s => `
      <div class="fitpass-card bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm flex flex-col justify-between">
        <div class="relative h-44 overflow-hidden">
          <img src="${s.image_url}" class="w-full h-full object-cover">
          <span class="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase bg-white text-slate-900 shadow-sm">
            ${s.category}
          </span>
          <button onclick="app.toggleFavorite(${s.id})" class="absolute top-3 right-3 p-2 rounded-full bg-rose-500 text-white shadow-md">
            <i data-lucide="heart" class="w-4 h-4 fill-current"></i>
          </button>
        </div>

        <div class="p-5 space-y-3">
          <div>
            <span class="text-xs text-indigo-600 font-bold">${s.neighborhood}</span>
            <h3 class="font-extrabold text-base text-slate-900">${s.name}</h3>
            <p class="text-xs text-slate-500 line-clamp-2 mt-1">${s.description}</p>
          </div>

          <button onclick="app.openStudioModal(${s.id})" class="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition">
            Ver Horarios y Reservar
          </button>
        </div>
      </div>
    `).join('');

    lucide.createIcons();
  },

  // Admin View
  renderAdminView() {
    document.getElementById('adminStudiosCount').innerText = this.state.studios.length;
    document.getElementById('adminClassesCount').innerText = this.state.classes.length;

    const tbody = document.getElementById('adminClassesTableBody');
    if (!tbody) return;

    tbody.innerHTML = this.state.classes.map(c => `
      <tr class="hover:bg-slate-50 transition">
        <td class="py-3">
          <span class="font-bold text-slate-900 block">${c.title}</span>
          <span class="text-[10px] text-indigo-600 font-semibold">${c.category} • ${c.duration_minutes} min</span>
        </td>
        <td class="py-3 text-slate-700 font-semibold">${c.studio_name}</td>
        <td class="py-3 text-slate-600">${c.instructor_name}</td>
        <td class="py-3 text-slate-800 font-mono">${c.start_time}</td>
        <td class="py-3 font-bold text-teal-700">${c.credit_cost} cr</td>
        <td class="py-3 font-bold ${c.available_spots <= 3 ? 'text-rose-600' : 'text-slate-800'}">
          ${c.available_spots} / ${c.max_capacity}
        </td>
      </tr>
    `).join('');
  },

  openAdminNewClassModal() {
    const select = document.getElementById('adminStudioSelect');
    if (select) {
      select.innerHTML = this.state.studios.map(s => `
        <option value="${s.id}">${s.name} (${s.neighborhood})</option>
      `).join('');
    }

    // Set default datetime to tomorrow at 09:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    document.getElementById('adminClassStartTime').value = `${dateStr}T09:00`;

    document.getElementById('adminNewClassModal').classList.remove('hidden');
  },

  closeAdminModal() {
    document.getElementById('adminNewClassModal').classList.add('hidden');
  },

  async handleCreateAdminClass(e) {
    e.preventDefault();
    const rawStartTime = document.getElementById('adminClassStartTime').value;
    const formattedStartTime = rawStartTime.replace('T', ' ');

    const payload = {
      studio_id: parseInt(document.getElementById('adminStudioSelect').value),
      title: document.getElementById('adminClassTitle').value,
      category: document.getElementById('adminClassCategory').value,
      level: document.getElementById('adminClassLevel').value,
      start_time: formattedStartTime,
      duration_minutes: parseInt(document.getElementById('adminClassDuration').value),
      credit_cost: parseInt(document.getElementById('adminClassCredits').value),
      max_capacity: parseInt(document.getElementById('adminClassCapacity').value),
      description: document.getElementById('adminClassDescription').value
    };

    try {
      const res = await fetch('/api/admin/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        this.closeAdminModal();
        this.showToast(data.message, "check");
        await this.fetchClasses();
        this.renderAdminView();
      }
    } catch (err) {
      console.error(err);
    }
  },

  // Dropdown helper
  toggleUserDropdown() {
    const menu = document.getElementById('userDropdown');
    menu.classList.toggle('hidden');
  },

  // Toast Notification
  showToast(message, icon = 'check') {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toastMessage');
    const iconContainer = document.getElementById('toastIcon');

    msg.innerText = message;
    iconContainer.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i>`;
    lucide.createIcons();

    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  },

  // Partner Income Calculator
  updatePartnerCalculator() {
    const spots = parseInt(document.getElementById('calcSpotsRange').value);
    const rate = parseInt(document.getElementById('calcRateRange').value);

    document.getElementById('calcSpotsVal').innerText = `${spots} cupos / día`;
    document.getElementById('calcRateVal').innerText = `$${rate.toLocaleString('es-CL')} CLP / crédito`;

    // Calculation: spots * 5 credits avg per class * rate * 24 active business days
    const monthlyTotal = spots * 5 * rate * 24;
    document.getElementById('calcEstimatedIncome').innerText = `$${monthlyTotal.toLocaleString('es-CL')} CLP`;
  },

  // Reception Pass Validation Simulator
  validateReceptionPass() {
    const code = document.getElementById('adminQrInput').value.trim();
    const resultBox = document.getElementById('receptionValidationResult');
    const details = document.getElementById('receptionPassDetails');

    if (!code) {
      this.showToast("Ingresa un código de pase digital", "alert-circle");
      return;
    }

    resultBox.classList.remove('hidden');
    details.innerText = `Pase: ${code} • Alumno: ${this.state.user ? this.state.user.name : 'Ignacio Sánchez'} • Entrada autorizada`;
    this.showToast("¡Pase escaneado y validado con éxito!", "check-circle");
    lucide.createIcons();
  },

  setupEventListeners() {
    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
      const btn = document.getElementById('userMenuBtn');
      const dropdown = document.getElementById('userDropdown');
      if (btn && dropdown && !btn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  }
};

// Auto start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
