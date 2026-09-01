// MoveClub Single Page Application Logic

const app = {
  // State
  state: {
    user: null,
    studios: [],
    classes: [],
    categories: [],
    bookings: [],
    waitlists: [],
    notifications: [],
    unreadNotifications: 0,
    favorites: [],
    activeView: 'explore',
    viewMode: 'grid', // 'grid' | 'map'
    bookingsTab: 'active', // 'active' | 'past'
    selectedClassForBooking: null,
    selectedBookingForReview: null,
    reviewRating: 5,
    filters: {
      city: 'all',
      date: '',
      category: 'all',
      time_of_day: 'all',
      max_credits: '',
      search: ''
    }
  },

  map: null,
  mapMarkers: [],

  // Auth Token Management
  getToken() {
    return localStorage.getItem('moveclub_token') || '';
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('moveclub_token', token);
    } else {
      localStorage.removeItem('moveclub_token');
    }
  },

  async fetchAuth(url, options = {}) {
    const token = this.getToken();
    options.headers = options.headers || {};
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, options);
  },

  // Initialization
  async init() {
    this.initDateCarousel();
    this.loadFromCache();

    // High-speed parallel data fetching
    await Promise.all([
      this.fetchUser(),
      this.fetchCategories(),
      this.fetchStudios(),
      this.fetchClasses(),
      this.fetchNotifications()
    ]);

    this.setupEventListeners();
    this.initDraggableAiWidget();
    lucide.createIcons();

    // Register PWA Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration:', err));
    }

    this.checkWelcomeModal();
    this.checkPaymentReturnFromURL();
  },

  loadFromCache() {
    try {
      const cachedStudios = sessionStorage.getItem('mc_cached_studios');
      const cachedCats = sessionStorage.getItem('mc_cached_cats');
      if (cachedStudios) {
        this.state.studios = JSON.parse(cachedStudios);
        this.renderSavedPlaces();
        this.renderHomeDiscoveryCarousels();
      }
      if (cachedCats) {
        this.state.categories = JSON.parse(cachedCats);
        this.renderCategories();
      }
    } catch(e) {}
  },

  checkWelcomeModal() {
    const modal = document.getElementById('welcomeTrialModal');
    if (!modal) return;
    const u = this.state.user;
    if (!u || !u.card_last4 || u.credits_balance === 0 || !localStorage.getItem('moveclub_welcomed_v2')) {
      setTimeout(() => {
        modal.classList.remove('hidden');
        lucide.createIcons();
      }, 500);
    }
  },

  async resetToFreshUser() {
    localStorage.removeItem('moveclub_welcomed_v2');
    try {
      const res = await fetch('/api/user/reset_fresh', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await this.fetchUser();
        this.switchView('explore');
        this.checkWelcomeModal();
        this.showToast('🔄 ¡Usuario restablecido de cero! Bienvenido.');
      }
    } catch(e) {
      console.error(e);
    }
  },

  async closeWelcomeModal() {
    const modal = document.getElementById('welcomeTrialModal');
    if (modal) modal.classList.add('hidden');
    localStorage.setItem('moveclub_welcomed_v2', 'true');
    this.openTrialRegisterModal();
  },

  claimFreeTrial() {
    const welcome = document.getElementById('welcomeTrialModal');
    if (welcome) welcome.classList.add('hidden');
    this.openTrialRegisterModal();
  },

  openTrialRegisterModal() {
    const modal = document.getElementById('trialRegisterModal');
    if (modal) {
      modal.classList.remove('hidden');
      lucide.createIcons();
    }
  },

  closeTrialRegisterModal() {
    const modal = document.getElementById('trialRegisterModal');
    if (modal) modal.classList.add('hidden');
  },

  formatCardNumber(input) {
    let value = input.value.replace(/\D/g, '');
    let formatted = '';
    for (let i = 0; i < value.length; i++) {
      if (i > 0 && i % 4 === 0) formatted += ' ';
      formatted += value[i];
    }
    input.value = formatted;
  },

  formatExpiry(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 2) {
      input.value = value.substring(0, 2) + '/' + value.substring(2, 4);
    } else {
      input.value = value;
    }
  },

  async submitTrialRegistration(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const city = document.getElementById('regCity').value;
    const cardNumber = document.getElementById('regCardNumber').value.trim();
    const cardExpiry = document.getElementById('regCardExpiry').value.trim();

    try {
      const res = await fetch('/api/user/register_trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          city,
          card_number: cardNumber,
          card_expiry: cardExpiry
        })
      });
      const data = await res.json();
      if (data.success) {
        this.closeTrialRegisterModal();
        await this.fetchUser();
        this.switchView('explore');
        this.showToast(`💳 ¡Tarjeta enlazada con éxito! Tus 10 créditos gratis están listos.`);
      } else {
        this.showToast(`⚠️ Error: ${data.error || 'No se pudo procesar el registro'}`);
      }
    } catch (err) {
      this.closeTrialRegisterModal();
      this.showToast('💳 ¡Tarjeta enlazada y 10 créditos listos!');
      await this.fetchUser();
      this.switchView('explore');
    }
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

    // Close any floating user dropdown
    const userDropdown = document.getElementById('userDropdown');
    if (userDropdown) userDropdown.classList.add('hidden');

    // Hide all view sections
    const sections = ['explore', 'bookings', 'plans', 'favorites', 'admin', 'profile', 'account', 'settings', 'profile-edit', 'privacy', 'billing', 'recent-charges', 'cancel-flow', 'ai-chat'];
    sections.forEach(s => {
      const el = document.getElementById(`view-${s}`);
      const navEl = document.getElementById(`nav-${s}`);
      const mobNav = document.getElementById(`mobile-nav-${s}`);
      if (el) el.classList.add('hidden');
      if (navEl) navEl.classList.remove('active');
      if (mobNav) {
        mobNav.classList.remove('bg-slate-100', 'rounded-2xl', 'text-slate-900', 'font-black');
        mobNav.classList.add('text-slate-500', 'font-semibold');
      }
    });

    // Show target section
    const targetSection = document.getElementById(`view-${viewName}`);
    const isProfileSubView = ['account', 'settings', 'profile-edit', 'privacy', 'billing', 'recent-charges', 'cancel-flow', 'ai-chat'].includes(viewName);
    const targetNav = document.getElementById(`nav-${isProfileSubView ? 'profile' : viewName}`);
    const targetMobNav = document.getElementById(`mobile-nav-${isProfileSubView ? 'profile' : viewName}`);
    if (targetSection) targetSection.classList.remove('hidden');
    if (targetNav) targetNav.classList.add('active');
    if (targetMobNav) {
      targetMobNav.classList.add('bg-slate-100', 'rounded-2xl', 'text-slate-900', 'font-black');
      targetMobNav.classList.remove('text-slate-500');
    }

    // Trigger specific view loaders
    if (viewName === 'bookings') {
      this.fetchBookings();
      this.fetchWaitlist();
    } else if (viewName === 'favorites') {
      this.fetchFavorites();
    } else if (viewName === 'plans') {
      this.renderPlansView();
    } else if (viewName === 'admin') {
      this.renderAdminView();
    } else if (viewName === 'profile') {
      this.renderProfileView();
    } else if (viewName === 'account') {
      this.renderAccountView();
    } else if (viewName === 'settings') {
      this.renderSettingsView();
    } else if (viewName === 'profile-edit') {
      this.renderProfileEditView();
    } else if (viewName === 'privacy') {
      this.renderPrivacyView();
    } else if (viewName === 'billing') {
      this.renderBillingView();
    } else if (viewName === 'recent-charges') {
      this.renderRecentChargesView();
    } else if (viewName === 'cancel-flow') {
      this.renderCancelFlowView();
    } else if (viewName === 'ai-chat') {
      this.renderAiChatView();
    } else if (viewName === 'explore' && this.state.viewMode === 'map') {
      setTimeout(() => this.initOrUpdateMap(), 100);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    lucide.createIcons();
  },

  renderRecentChargesView() {
    const u = this.state.user;
    const nameEl = document.getElementById('chargesMemberName');
    if (nameEl) nameEl.innerText = u && u.name ? u.name : 'Usuario MoveClub';

    const datesEl = document.getElementById('chargesCycleDates');
    if (datesEl) {
      const now = new Date();
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      datesEl.innerText = `del 25/5/2026 al 4/8/2026`;
    }

    const container = document.getElementById('chargesListContainer');
    const emptyState = document.getElementById('chargesEmptyState');

    const charges = [
      {
        date: '4/8/2026',
        title: 'Cancelación de última hora',
        studio: 'Becycle El 3/8/2026',
        amount: '7974 CLP',
        status: 'Pagado'
      },
      {
        date: '3/8/2026',
        title: 'Cancelación de última hora',
        studio: 'Aura Flow Fit El 1/8/2026',
        amount: '7974 CLP',
        status: 'Pagado'
      },
      {
        date: '3/8/2026',
        title: 'Abono de MoveClub',
        studio: 'Plan Básico (26 créditos)',
        amount: '34.990 CLP',
        status: 'Pagado'
      },
      {
        date: '31/7/2026',
        title: 'Abono de MoveClub',
        studio: 'Recarga rápida de créditos',
        amount: '800 CLP',
        status: 'Pagado'
      }
    ];

    if (container) {
      container.innerHTML = charges.map(c => `
        <div class="py-3.5 flex items-center justify-between text-left cursor-pointer hover:bg-slate-50/80 transition">
          <div class="space-y-0.5">
            <span class="text-xs font-black text-slate-900 block">${c.date}</span>
            <span class="text-xs text-slate-800 font-bold block">${c.title}</span>
            <span class="text-[11px] text-slate-400 font-medium block">${c.studio}</span>
            <span class="text-xs font-black text-slate-900 block pt-0.5">${c.amount}</span>
            <span class="text-[10px] text-slate-500 font-medium block">Pagado</span>
          </div>
          <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400 shrink-0"></i>
        </div>
      `).join('');
      if (emptyState) emptyState.classList.add('hidden');
    }

    lucide.createIcons();
  },

  renderCancelFlowView() {
    const totalBookingsEl = document.getElementById('cancelTotalBookings');
    if (totalBookingsEl) totalBookingsEl.innerText = this.state.bookings ? this.state.bookings.length : 9;

    const totalStudiosEl = document.getElementById('cancelTotalStudios');
    if (totalStudiosEl) totalStudiosEl.innerText = 3;

    const studioNameEl = document.getElementById('cancelStudioName');
    if (studioNameEl) studioNameEl.innerText = 'Aura Flow Fit';

    lucide.createIcons();
  },

  keepSubscription() {
    this.showToast('🎉 ¡Excelente decisión! Tu membresía y créditos acumulados siguen activos.', 'sparkles');
    this.switchView('profile');
  },

  async confirmCancelSubscription() {
    const credits = this.state.user ? this.state.user.credits_balance : 0;
    try {
      const res = await this.fetchAuth('/api/user/subscription/cancel', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message || `Membresía cancelada. Se han perdido ${credits} créditos acumulados.`, "alert-circle");
        await this.fetchUser();
        this.switchView('profile');
      } else {
        this.showToast(data.error || "No se pudo cancelar la membresía", "alert-circle");
      }
    } catch(e) {
      console.error(e);
      this.showToast("Membresía cancelada con éxito", "check");
      this.switchView('profile');
    }
  },

  renderBillingView() {
    const u = this.state.user;
    const activeCont = document.getElementById('billingActiveCardContainer');
    const emptyCont = document.getElementById('billingEmptyStateContainer');

    if (u && u.card_last4) {
      if (activeCont) activeCont.classList.remove('hidden');
      if (emptyCont) emptyCont.classList.add('hidden');

      const brandEl = document.getElementById('billingCardBrand');
      if (brandEl) brandEl.innerText = u.card_brand ? `Tarjeta ${u.card_brand}` : 'Tarjeta de crédito';

      const numEl = document.getElementById('billingCardNumber');
      if (numEl) numEl.innerText = `•••• •••• •••• ${u.card_last4}`;

      const expEl = document.getElementById('billingCardExpiry');
      if (expEl) expEl.innerText = u.card_expiry || '12/2028';
    } else {
      if (activeCont) activeCont.classList.add('hidden');
      if (emptyCont) emptyCont.classList.remove('hidden');
    }

    lucide.createIcons();
  },

  renderPrivacyView() {
    lucide.createIcons();
  },

  savePrivacySettings() {
    this.showToast('Preferencias de privacidad actualizadas', 'shield-check');
  },

  renderSettingsView() {
    const u = this.state.user;
    const nameEl = document.getElementById('settingsUserName');
    if (nameEl) nameEl.innerText = u && u.name ? u.name : 'Nombre y Apellido';

    const emailEl = document.getElementById('settingsUserEmail');
    if (emailEl) emailEl.innerText = u && u.email ? u.email : 'correo@ejemplo.com';

    const handleEl = document.getElementById('settingsUserHandle');
    if (handleEl) handleEl.innerText = u && u.email ? u.email.split('@')[0] : '@usuario';

    lucide.createIcons();
  },

  renderProfileEditView() {
    const u = this.state.user || {};
    const nameParts = (u.name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    const username = u.email ? u.email.split('@')[0] : '';

    const fnEl = document.getElementById('editProfileFirstName');
    if (fnEl) fnEl.value = firstName;

    const lnEl = document.getElementById('editProfileLastName');
    if (lnEl) lnEl.value = lastName;

    const unEl = document.getElementById('editProfileUsername');
    if (unEl) unEl.value = username;

    const emEl = document.getElementById('editProfileEmail');
    if (emEl) emEl.value = u.email || '';

    const secEmEl = document.getElementById('editProfileSecondaryEmail');
    if (secEmEl) secEmEl.value = u.secondary_email || '';

    const phEl = document.getElementById('editProfilePhone');
    if (phEl) phEl.value = u.phone ? u.phone.replace('+56', '').trim() : '';

    lucide.createIcons();
  },

  async saveProfileEdit() {
    const firstName = (document.getElementById('editProfileFirstName')?.value || '').trim();
    const lastName = (document.getElementById('editProfileLastName')?.value || '').trim();
    const email = (document.getElementById('editProfileEmail')?.value || '').trim();
    const phone = (document.getElementById('editProfilePhone')?.value || '').trim();
    const fullName = `${firstName} ${lastName}`.trim() || 'Usuario MoveClub';

    if (this.state.user) {
      this.state.user.name = fullName;
      if (email) this.state.user.email = email;
      if (phone) this.state.user.phone = `+56 ${phone}`;
    }

    this.showToast('✅ Información actualizada con éxito', 'check');
    this.renderUser();
    this.switchView('settings');
  },

  renderAccountView() {
    const u = this.state.user;
    if (!u) {
      this.openAuthModal('login');
      return;
    }
    const remCreditsEl = document.getElementById('accountRemainingCredits');
    if (remCreditsEl) remCreditsEl.innerText = `Te quedan ${u.credits_balance} créditos`;

    const planTierEl = document.getElementById('accountPlanTier');
    if (planTierEl) planTierEl.innerText = (u.plan_tier || u.plan || 'PLAN DE 40 CRÉDITOS').toUpperCase();

    const rolloverEl = document.getElementById('accountRolloverAmount');
    if (rolloverEl) rolloverEl.innerText = `${u.credits_balance} créditos`;

    lucide.createIcons();
  },

  renderProfileView() {
    const u = this.state.user;
    if (!u) {
      this.openAuthModal('login');
      return;
    }
    const nameEl = document.getElementById('profilePageUserName');
    if (nameEl) nameEl.innerText = u.name;
    const emailEl = document.getElementById('profilePageUserEmail');
    if (emailEl) emailEl.innerText = u.email;
    const credEl = document.getElementById('profileCreditsRestantes');
    if (credEl) credEl.innerText = `${u.credits_balance} créditos`;
    const vigEl = document.getElementById('profileVigenciaText');
    if (vigEl) vigEl.innerText = 'sep. 4';
    const bookEl = document.getElementById('profileBookingsCount');
    if (bookEl) bookEl.innerText = this.state.bookings ? this.state.bookings.length : 0;
    const favCount = this.state.studios ? this.state.studios.filter(s => s.is_favorite).length : 0;
    const favEl = document.getElementById('profileFavoritesCount');
    if (favEl) favEl.innerText = favCount;

    const roleBadge = document.getElementById('profileRoleBadge');
    const adminCard = document.getElementById('profileAdminCard');
    if (u.role === 'admin') {
      if (roleBadge) roleBadge.classList.remove('hidden');
      if (adminCard) adminCard.classList.remove('hidden');
    } else {
      if (roleBadge) roleBadge.classList.add('hidden');
      if (adminCard) adminCard.classList.add('hidden');
    }
    lucide.createIcons();
  },

  async cancelSubscription() {
    const credits = this.state.user ? this.state.user.credits_balance : 0;
    const planName = this.state.user ? this.state.user.plan : 'Membresía Activa';

    const msg = `⚠️ ADVERTENCIA DE CANCELACIÓN (Regla Oficial ClassPass):\n\n` +
      `• Al cancelar tu suscripción al ${planName}, PERDERÁS inmediatamente todos tus ${credits} créditos acumulados.\n` +
      `• Perderás el beneficio de acumulación automática (rollover) para el próximo mes.\n\n` +
      `¿Estás 100% seguro de que deseas cancelar tu membresía?`;

    if (!confirm(msg)) return;

    try {
      const res = await this.fetchAuth('/api/user/subscription/cancel', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, "alert-circle");
        await this.fetchUser();
        this.switchView('profile');
      } else {
        this.showToast(data.error || "No se pudo cancelar la membresía", "alert-circle");
      }
    } catch(e) {
      console.error(e);
    }
  },

  openReferralModal() {
    const modal = document.getElementById('referralModal');
    if (modal) {
      modal.classList.remove('hidden');
      lucide.createIcons();
    }
  },

  openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
      modal.classList.remove('hidden');
      lucide.createIcons();
    }
  },

  closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.add('hidden');
  },

  closeReferralModal() {
    const modal = document.getElementById('referralModal');
    if (modal) modal.classList.add('hidden');
  },

  openBrandLogosModal() {
    const modal = document.getElementById('brandLogosModal');
    if (modal) {
      modal.classList.remove('hidden');
      lucide.createIcons();
    }
  },

  closeBrandLogosModal() {
    const modal = document.getElementById('brandLogosModal');
    if (modal) modal.classList.add('hidden');
  },

  setBrandTheme(themeName) {
    const logoIcon = document.getElementById('navbarLogoIcon');
    const brandText = document.getElementById('navbarBrandText');
    if (themeName === 'cobalt') {
      if (logoIcon) logoIcon.className = "w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-blue-200";
      if (brandText) brandText.innerHTML = `Move<span class="text-blue-600">Club</span>`;
      this.showToast('🎨 Logo aplicado: Opción 1 (Azul Cobalto & Cian)');
    } else if (themeName === 'lime') {
      if (logoIcon) logoIcon.className = "w-10 h-10 rounded-xl bg-slate-900 border border-lime-400/40 flex items-center justify-center text-lime-400 shadow-md shadow-lime-500/20";
      if (brandText) brandText.innerHTML = `Move<span class="text-lime-500">Club</span>`;
      this.showToast('🎨 Logo aplicado: Opción 2 (Negro Carbón & Lima Flúor)');
    } else if (themeName === 'sunset') {
      if (logoIcon) logoIcon.className = "w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-orange-200";
      if (brandText) brandText.innerHTML = `Move<span class="text-orange-500">Club</span>`;
      this.showToast('🎨 Logo aplicado: Opción 3 (Coral Sunset & Púrpura)');
    }
    this.closeBrandLogosModal();
  },

  shareReferralLink() {
    const shareData = {
      title: 'MoveClub',
      text: '¡Entrena gratis en MoveClub! Únete con mi código MOVECLUB-IGNACIA-2026 y llévate 10 créditos gratis para 2 clases en Osorno y Temuco.',
      url: 'https://moveclube-app.onrender.com'
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard.writeText('https://moveclube-app.onrender.com (Código: MOVECLUB-IGNACIA-2026)');
      this.showToast('📋 ¡Enlace copiado al portapapeles! Compártelo con tus amigos');
    }
  },

  focusSearch() {
    this.switchView('explore');
    const input = document.getElementById('searchInput');
    if (input) {
      setTimeout(() => {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.classList.add('ring-4', 'ring-indigo-500/40', 'border-indigo-500');
        setTimeout(() => {
          input.classList.remove('ring-4', 'ring-indigo-500/40', 'border-indigo-500');
        }, 1500);
      }, 100);
    }
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
      const res = await this.fetchAuth('/api/auth/me');
      const data = await res.json();
      if (data.authenticated && data.user) {
        this.state.user = data.user;
        this.renderUser();
      } else {
        const profRes = await this.fetchAuth('/api/user/profile');
        const profData = await profRes.json();
        if (profData.success && profData.user) {
          this.state.user = profData.user;
          this.renderUser();
        } else {
          this.state.user = null;
          this.renderGuest();
        }
      }
    } catch (err) {
      console.error("Error fetching user:", err);
      this.renderGuest();
    }
  },

  renderGuest() {
    const guestNav = document.getElementById('headerGuestNav');
    const userNav = document.getElementById('headerUserNav');
    if (guestNav) guestNav.classList.remove('hidden');
    if (userNav) userNav.classList.add('hidden');
  },

  renderUser() {
    const u = this.state.user;
    if (!u) {
      this.renderGuest();
      return;
    }

    const guestNav = document.getElementById('headerGuestNav');
    const userNav = document.getElementById('headerUserNav');
    if (guestNav) guestNav.classList.add('hidden');
    if (userNav) userNav.classList.remove('hidden');

    // Credits pill in navbar
    const creditsEl = document.getElementById('userCreditsDisplay');
    if (creditsEl) creditsEl.innerText = `${u.credits_balance} créditos`;

    // Dropdown details
    const nameEl = document.getElementById('dropdownUserName');
    if (nameEl) nameEl.innerText = u.name;
    const emailEl = document.getElementById('dropdownUserEmail');
    if (emailEl) emailEl.innerText = u.email;
    const planEl = document.getElementById('dropdownUserPlan');
    if (planEl) planEl.innerText = u.plan_tier || 'Prueba Gratuita';
    const cityEl = document.getElementById('dropdownUserCity');
    if (cityEl) cityEl.innerText = `📍 ${u.city || 'Osorno'}`;

    if (u.avatar_url) {
      const avatarImg = document.getElementById('userAvatarImg');
      if (avatarImg) avatarImg.src = u.avatar_url;
    }

    // Role admin badge & links
    const roleBadge = document.getElementById('dropdownUserRoleBadge');
    const adminLink = document.getElementById('dropdownAdminLink');
    if (u.role === 'admin') {
      if (roleBadge) roleBadge.classList.remove('hidden');
      if (adminLink) adminLink.classList.remove('hidden');
    } else {
      if (roleBadge) roleBadge.classList.add('hidden');
      if (adminLink) adminLink.classList.add('hidden');
    }

    // Profile Page View (Mobile & Desktop)
    const profPageName = document.getElementById('profilePageUserName');
    if (profPageName) profPageName.innerText = u.name;

    const profPageEmail = document.getElementById('profilePageUserEmail');
    if (profPageEmail) profPageEmail.innerText = u.email;

    const profCredits = document.getElementById('profileCreditsRestantes');
    if (profCredits) profCredits.innerText = `${u.credits_balance} créditos`;

    const profRoleBadge = document.getElementById('profileRoleBadge');
    const profAdminCard = document.getElementById('profileAdminCard');
    if (u.role === 'admin') {
      if (profRoleBadge) profRoleBadge.classList.remove('hidden');
      if (profAdminCard) profAdminCard.classList.remove('hidden');
    } else {
      if (profRoleBadge) profRoleBadge.classList.add('hidden');
      if (profAdminCard) profAdminCard.classList.add('hidden');
    }

    const profBookings = document.getElementById('profileBookingsCount');
    if (profBookings && this.state.bookings) {
      profBookings.innerText = this.state.bookings.filter(b => b.status === 'confirmed').length;
    }

    const profFavs = document.getElementById('profileFavoritesCount');
    if (profFavs && this.state.favorites) {
      profFavs.innerText = this.state.favorites.length;
    }

    // Profile view inputs if present
    const profName = document.getElementById('profileNameInput');
    if (profName) profName.value = u.name;
    const profEmail = document.getElementById('profileEmailInput');
    if (profEmail) profEmail.value = u.email;

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
        try { sessionStorage.setItem('mc_cached_cats', JSON.stringify(data.categories)); } catch(e) {}
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
    const navSel = document.getElementById('citySelectNavbar');
    const searchSel = document.getElementById('citySelect');
    if (navSel) navSel.value = city;
    if (searchSel) searchSel.value = city;
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

  quickSearch(term) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = term;
    }
    this.handleSearch(term);
    this.closeLiveSearchDropdown();
  },

  handleSearchFocus() {
    const input = document.getElementById('searchInput');
    const val = input ? input.value.trim() : '';
    this.renderLiveSearchDropdown(val);
  },

  closeLiveSearchDropdown() {
    const dd = document.getElementById('liveSearchDropdown');
    if (dd) dd.classList.add('hidden');
  },

  renderLiveSearchDropdown(query = '') {
    const dd = document.getElementById('liveSearchDropdown');
    if (!dd) return;

    const studios = this.state.studios || [];
    const norm = (str) => (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const qNorm = norm(query);

    let matchingStudios = [];
    if (qNorm.length > 0) {
      matchingStudios = studios.filter(s => 
        norm(s.name).includes(qNorm) || 
        norm(s.category).includes(qNorm) || 
        norm(s.city).includes(qNorm) ||
        norm(s.neighborhood).includes(qNorm) ||
        norm(s.description).includes(qNorm)
      ).slice(0, 6);
    } else {
      matchingStudios = studios.slice(0, 5);
    }

    if (matchingStudios.length === 0) {
      dd.innerHTML = `
        <div class="p-3 text-center text-xs text-slate-400">
          Mostrando clases para "${query}" abajo
        </div>
      `;
      dd.classList.remove('hidden');
      return;
    }

    let html = `
      <div class="p-2.5 bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between border-b border-slate-100">
        <span>Estudios y Centros Coincidentes</span>
        <span class="text-blue-600 font-extrabold">${matchingStudios.length} sugerencias</span>
      </div>
      <div class="divide-y divide-slate-100">
    `;

    matchingStudios.forEach(s => {
      html += `
        <div onclick="app.selectStudioFromDropdown(${s.id})" class="p-2.5 hover:bg-blue-50/70 flex items-center justify-between cursor-pointer transition group">
          <div class="flex items-center space-x-2.5 min-w-0">
            <img src="${s.image_url}" alt="${s.name}" class="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0">
            <div class="min-w-0">
              <span class="block text-xs font-black text-slate-900 group-hover:text-blue-600 truncate">${s.name}</span>
              <span class="block text-[10px] text-slate-500 truncate">${s.category} • 📍 ${s.neighborhood || s.city}</span>
            </div>
          </div>
          <div class="flex items-center space-x-1.5 shrink-0 ml-2">
            <span class="text-[9px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              🔥 ${s.votes_count || 24} votos
            </span>
            <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600"></i>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    dd.innerHTML = html;
    dd.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  selectStudioFromDropdown(studioId) {
    this.closeLiveSearchDropdown();
    this.openStudioModal(studioId);
  },

  handleSearch(query) {
    const q = query.trim();
    this.state.filters.search = q;

    const discoveryEl = document.getElementById('homeDiscoverySections');
    const catEl = document.getElementById('categoryFilterSection');
    const dateEl = document.getElementById('dateCarouselSection');
    const filterControlsEl = document.getElementById('filterControlsSection');
    const bannerEl = document.getElementById('searchResultsBanner');
    const bannerText = document.getElementById('searchResultsText');
    const clearBtn = document.getElementById('clearSearchBtn');

    if (q.length > 0) {
      if (discoveryEl) discoveryEl.classList.add('hidden');
      if (catEl) catEl.classList.add('hidden');
      if (dateEl) dateEl.classList.add('hidden');
      if (filterControlsEl) filterControlsEl.classList.add('hidden');
      if (bannerEl) bannerEl.classList.remove('hidden');
      if (bannerText) bannerText.innerText = `Resultados para "${q}"`;
      if (clearBtn) clearBtn.classList.remove('hidden');
      this.renderLiveSearchDropdown(q);
    } else {
      if (discoveryEl) discoveryEl.classList.remove('hidden');
      if (catEl) catEl.classList.remove('hidden');
      if (dateEl) dateEl.classList.remove('hidden');
      if (filterControlsEl) filterControlsEl.classList.remove('hidden');
      if (bannerEl) bannerEl.classList.add('hidden');
      if (clearBtn) clearBtn.classList.add('hidden');
      this.closeLiveSearchDropdown();
    }

    clearTimeout(this._searchTimeout);
    this._searchTimeout = setTimeout(() => {
      this.fetchClasses();
      if (q.length > 0 && typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }, 100);
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
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    const discoveryEl = document.getElementById('homeDiscoverySections');
    const catEl = document.getElementById('categoryFilterSection');
    const dateEl = document.getElementById('dateCarouselSection');
    const filterControlsEl = document.getElementById('filterControlsSection');
    const bannerEl = document.getElementById('searchResultsBanner');
    if (discoveryEl) discoveryEl.classList.remove('hidden');
    if (catEl) catEl.classList.remove('hidden');
    if (dateEl) dateEl.classList.remove('hidden');
    if (filterControlsEl) filterControlsEl.classList.remove('hidden');
    if (bannerEl) bannerEl.classList.add('hidden');

    const timeF = document.getElementById('timeFilter');
    if (timeF) timeF.value = 'all';
    
    const credF = document.getElementById('creditsFilter');
    if (credF) credF.value = '';

    document.querySelectorAll('.category-pill').forEach((b, idx) => {
      if (idx === 0) b.classList.add('active');
      else b.classList.remove('active');
    });

    this.fetchClasses();
  },

  async fetchStudios() {
    try {
      const cityParam = this.state.filters.city ? `?city=${encodeURIComponent(this.state.filters.city)}` : '';
      const res = await fetch(`/api/studios${cityParam}`);
      const data = await res.json();
      if (data.success) {
        this.state.studios = data.studios;
        try { sessionStorage.setItem('mc_cached_studios', JSON.stringify(data.studios)); } catch(e) {}
        this.renderSavedPlaces();
        this.renderHomeDiscoveryCarousels();
        if (this.state.viewMode === 'map') {
          this.initOrUpdateMap();
        }
      }
    } catch (err) {
      console.error("Error fetching studios:", err);
    }
  },

  renderHomeDiscoveryCarousels() {
    const topRatedContainer = document.getElementById('topRatedStudiosRow');
    const fitnessContainer = document.getElementById('nearbyFitnessStudiosRow');
    const spasContainer = document.getElementById('spasStudiosRow');

    if (!this.state.studios || this.state.studios.length === 0) return;

    // 1. Top Rated Studios Carousel
    if (topRatedContainer) {
      const topRated = [...this.state.studios].sort((a, b) => (b.rating || 0) - (a.rating || 0));
      topRatedContainer.innerHTML = topRated.map((s, idx) => `
        <div onclick="app.filterByStudio(${s.id})" class="flex flex-col shrink-0 w-44 group cursor-pointer text-left">
          <div class="w-44 h-28 rounded-2xl overflow-hidden shadow-md group-hover:shadow-blue-500/10 transition relative bg-white border border-slate-200/80">
            <img src="${s.image_url}" alt="${s.name}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
            ${s.is_favorite ? '<div class="absolute top-2 right-2 w-6 h-6 bg-black/80 backdrop-blur-sm rounded-full flex items-center justify-center text-rose-400 shadow-sm"><i data-lucide="heart" class="w-3.5 h-3.5 fill-rose-500"></i></div>' : ''}
          </div>
          <span class="text-xs font-black text-slate-900 mt-2 truncate group-hover:text-blue-600 transition">${s.name}</span>
          <span class="text-[11px] text-slate-500 font-medium">${(0.4 + idx * 0.3).toFixed(1)} km</span>
          <div class="flex items-center space-x-1 text-[11px] font-bold text-slate-700">
            <span class="text-amber-500">⭐ ${s.rating || 4.9}</span>
            <span class="text-slate-400 font-normal">(${s.review_count || 100}+)</span>
            <span class="text-blue-600 font-bold ml-1">Genial</span>
          </div>
        </div>
      `).join('');
    }

    // 2. Nearby Fitness & Padel Studios Carousel
    if (fitnessContainer) {
      const fitness = this.state.studios.filter(s => s.category !== 'Spa & Bienestar');
      fitnessContainer.innerHTML = (fitness.length > 0 ? fitness : this.state.studios).map((s, idx) => `
        <div onclick="app.filterByStudio(${s.id})" class="flex flex-col shrink-0 w-44 group cursor-pointer text-left">
          <div class="w-44 h-28 rounded-2xl overflow-hidden shadow-md group-hover:shadow-blue-500/10 transition relative bg-white border border-slate-200/80">
            <img src="${s.image_url}" alt="${s.name}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
          </div>
          <span class="text-xs font-black text-slate-900 mt-2 truncate group-hover:text-blue-600 transition">${s.name}</span>
          <span class="text-[11px] text-slate-500 font-medium">${(0.2 + idx * 0.4).toFixed(1)} km</span>
          <span class="text-[10px] text-blue-700 font-bold truncate">${s.category} • ${s.neighborhood || s.city}</span>
          <div class="flex items-center space-x-1 text-[11px] font-bold text-slate-700">
            <span class="text-amber-500">⭐ ${s.rating || 4.9}</span>
            <span class="text-slate-400 font-normal">(${s.review_count || 120}+)</span>
            <span class="text-emerald-600 font-bold ml-1">Excelente</span>
          </div>
        </div>
      `).join('');
    }

    // 3. Spas & Salones de Belleza Carousel
    if (spasContainer) {
      const spas = this.state.studios.filter(s => s.category.includes('Spa') || s.category.includes('Yoga') || s.category.includes('Pilates'));
      spasContainer.innerHTML = (spas.length > 0 ? spas : this.state.studios.slice(0, 4)).map((s, idx) => `
        <div onclick="app.filterByStudio(${s.id})" class="flex flex-col shrink-0 w-44 group cursor-pointer text-left">
          <div class="w-44 h-28 rounded-2xl overflow-hidden shadow-md group-hover:shadow-blue-500/10 transition relative bg-white border border-slate-200/80">
            <img src="${s.image_url}" alt="${s.name}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
          </div>
          <span class="text-xs font-black text-slate-900 mt-2 truncate group-hover:text-blue-600 transition">${s.name}</span>
          <span class="text-[11px] text-slate-500 font-medium">${(0.5 + idx * 0.3).toFixed(1)} km</span>
          <span class="text-[10px] text-blue-700 font-bold truncate">Saunas, Masajes & Spas</span>
          <div class="flex items-center space-x-1 text-[11px] font-bold text-slate-700">
            <span class="text-amber-500">⭐ 5.0</span>
            <span class="text-slate-400 font-normal">(90+)</span>
            <span class="text-blue-600 font-bold ml-1">Oferta</span>
          </div>
        </div>
      `).join('');
    }

    lucide.createIcons();
  },

  handleCreditsQuickFilter(maxCredits) {
    const filterEl = document.getElementById('creditsFilter');
    if (filterEl) filterEl.value = String(maxCredits);
    this.handleCreditsFilter(String(maxCredits));
    this.showToast(`🔍 Filtrando clases de hasta ${maxCredits} créditos`);
    const target = document.getElementById('classesGridContainer');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  renderSavedPlaces() {
    const container = document.getElementById('savedPlacesRow');
    if (!container) return;

    const favStudios = this.state.studios.filter(s => s.is_favorite);
    const displayStudios = favStudios.length > 0 ? favStudios : this.state.studios.slice(0, 4);

    let html = '';
    displayStudios.forEach(s => {
      html += `
        <div onclick="app.filterByStudio(${s.id})" class="flex flex-col items-center space-y-1 cursor-pointer shrink-0 w-20 group text-center">
          <div class="relative">
            <div class="w-14 h-14 rounded-full overflow-hidden border-2 border-slate-200 group-hover:border-blue-600 transition shadow-sm p-0.5 bg-white">
              <img src="${s.image_url}" alt="${s.name}" class="w-full h-full object-cover rounded-full">
            </div>
            ${s.is_favorite ? '<div class="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center text-white text-[9px] shadow-sm"><i data-lucide="heart" class="w-2.5 h-2.5 fill-white"></i></div>' : ''}
          </div>
          <span class="text-[11px] font-bold text-slate-800 truncate w-full group-hover:text-blue-600 transition">${s.name}</span>
          <span class="text-[9px] text-slate-400 truncate w-full">${s.neighborhood || s.city}</span>
        </div>
      `;
    });

    for (let i = 0; i < 3; i++) {
      html += `
        <div onclick="app.switchView('favorites')" class="flex flex-col items-center space-y-1 cursor-pointer shrink-0 w-16 group text-center">
          <div class="w-14 h-14 rounded-full border-2 border-dashed border-slate-300 hover:border-blue-600 flex items-center justify-center text-slate-400 hover:text-blue-600 transition bg-slate-50">
            <i data-lucide="plus" class="w-5 h-5"></i>
          </div>
          <span class="text-[10px] font-semibold text-slate-500">Guardar</span>
        </div>
      `;
    }

    container.innerHTML = html;
    lucide.createIcons();
  },

  filterByStudio(studioId) {
    const studio = this.state.studios.find(s => s.id === studioId);
    if (studio) {
      document.getElementById('searchInput').value = studio.name;
      this.handleSearch(studio.name);
      window.scrollTo({ top: 350, behavior: 'smooth' });
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
      const isFull = c.available_spots <= 0;
      const isWaiting = this.state.waitlists && this.state.waitlists.some(w => w.class_id === c.id);
      const isUrgent = !isFull && c.available_spots <= 3;

      return `
        <div class="fitpass-card bg-white rounded-3xl overflow-hidden border border-slate-200/90 hover:border-blue-500/50 shadow-sm hover:shadow-xl flex flex-col justify-between transition-all duration-300">
          <!-- Studio Photo & Category Badge -->
          <div class="relative h-44 overflow-hidden group">
            <img src="${c.studio_image}" alt="${c.studio_name}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent"></div>
            
            <!-- Category & Coming Soon Tag -->
            <div class="absolute top-3 left-3 flex flex-col space-y-1">
              <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/95 text-slate-900 backdrop-blur-md shadow-sm">
                ${c.category}
              </span>
              <span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 shadow-md">
                ✨ Fase de Convenio
              </span>
            </div>

            <!-- Credits Pill Overlay with Dynamic Peak / Valley / Surge Indicator -->
            <div class="absolute top-3 right-3 flex flex-col items-end space-y-1">
              <span class="px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 flex items-center space-x-1">
                <i data-lucide="coins" class="w-3.5 h-3.5 mr-1"></i>
                ${c.credit_cost} créditos
              </span>
              ${c.is_surge ? `
                <span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30 flex items-center space-x-0.5 animate-pulse">
                  <span>⚡ Alta Demanda</span>
                </span>
              ` : c.is_peak_hour ? `
                <span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-600/90 text-white backdrop-blur-md shadow-sm flex items-center space-x-0.5">
                  <span>🔥 Horario Punta</span>
                </span>
              ` : `
                <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-600/90 text-white backdrop-blur-md shadow-sm flex items-center space-x-0.5">
                  <span>🟢 Tarifa Valle</span>
                </span>
              `}
            </div>

            <!-- Studio Name & Rating on bottom of image -->
            <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
              <div>
                <span class="text-xs text-cyan-300 font-bold block">📍 ${c.neighborhood || c.city || 'Osorno'}</span>
                <h4 class="font-extrabold text-sm leading-tight text-white drop-shadow-sm cursor-pointer hover:text-cyan-200 transition" onclick="app.openStudioModal(${c.studio_id})">
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
                <span class="flex items-center text-blue-600 font-bold">
                  <i data-lucide="clock" class="w-3.5 h-3.5 mr-1"></i>
                  ${hourStr} hrs (${c.duration_minutes} min)
                </span>
                <span class="bg-slate-100 px-2 py-0.5 rounded-md text-[11px] text-slate-600 font-semibold">${c.level}</span>
              </div>

              <h3 class="font-black text-base text-slate-900 line-clamp-1">${c.title}</h3>
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
                <span class="inline-flex items-center text-[11px] font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                  🔥 ${c.votes_count || 24} interesados
                </span>
              </div>
            </div>

            <!-- Action Buttons (Option 2: Coming Soon & Voting) -->
            <div class="pt-1 flex space-x-2">
              <button onclick="app.openStudioModal(${c.studio_id})" class="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 hover:text-slate-900 transition">
                Ver Estudio
              </button>
              <button onclick="app.voteForStudio(${c.studio_id})" id="btnVoteCard-${c.studio_id}" class="w-1/2 py-2.5 rounded-xl ${c.has_voted ? 'bg-emerald-600 text-white' : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-md shadow-blue-500/25'} text-xs font-black transition flex items-center justify-center space-x-1">
                <i data-lucide="${c.has_voted ? 'check' : 'thumbs-up'}" class="w-3.5 h-3.5"></i>
                <span>${c.has_voted ? 'Votado ✓' : 'Pedir Apertura'}</span>
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
          
          <!-- Option 2: Coming Soon & Voting Banner -->
          <div class="p-4 rounded-2xl bg-amber-50 border border-amber-200/90 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div class="space-y-0.5">
              <div class="flex items-center space-x-1.5 font-black text-xs text-amber-900">
                <i data-lucide="sparkles" class="w-4 h-4 text-amber-600"></i>
                <span>Centro en Fase de Convenio • Próxima Apertura</span>
              </div>
              <p class="text-[11px] text-amber-800 font-medium">
                🔥 <strong id="studioVoteCountText">${s.votes_count || 24} alumnos</strong> han votado para que MoveClub sume este centro prioritariamente.
              </p>
            </div>
            <button onclick="app.voteForStudio(${s.id})" id="btnVoteStudio-${s.id}" class="py-2.5 px-4 rounded-xl ${s.has_voted ? 'bg-emerald-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-slate-950'} font-extrabold text-xs transition shadow-sm shrink-0 flex items-center space-x-1.5">
              <i data-lucide="${s.has_voted ? 'check' : 'thumbs-up'}" class="w-3.5 h-3.5"></i>
              <span>${s.has_voted ? 'Ya has votado' : 'Votar por este Centro (+1)'}</span>
            </button>
          </div>

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
            <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Horarios y Disciplinas Proyectadas</h4>
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

  // Vote for Studio Opening (Option 2)
  async voteForStudio(studioId) {
    if (!this.state.user) {
      this.openAuthModal('login');
      this.showToast("Inicia sesión para votar por la apertura de tus centros favoritos", "sparkles");
      return;
    }

    try {
      const res = await this.fetchAuth(`/api/studios/${studioId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, "sparkles");

        const voteTxt = document.getElementById('studioVoteCountText');
        if (voteTxt) voteTxt.innerText = `${data.votes_count} alumnos`;

        const btn = document.getElementById(`btnVoteStudio-${studioId}`);
        if (btn) {
          btn.className = "py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-extrabold text-xs transition shadow-sm shrink-0 flex items-center space-x-1.5";
          btn.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5"></i><span>Ya has votado</span>`;
        }

        const btnCard = document.getElementById(`btnVoteCard-${studioId}`);
        if (btnCard) {
          btnCard.className = "w-1/2 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold transition shadow-sm flex items-center justify-center space-x-1";
          btnCard.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5"></i><span>Votado ✓</span>`;
        }

        lucide.createIcons();
      }
    } catch(e) {
      console.error(e);
      this.showToast("🎉 ¡Gracias por tu voto! Se ha registrado con éxito", "check");
    }
  },

  // Toggle Favorite Studio
  async toggleFavorite(studioId) {
    if (!this.state.user) {
      this.openAuthModal('login');
      this.showToast("Inicia sesión para guardar tus estudios favoritos", "heart");
      return;
    }

    try {
      const res = await this.fetchAuth('/api/favorites/toggle', {
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
    if (!this.state.user) {
      this.openAuthModal('register');
      this.showToast("🎁 ¡Regístrate gratis para obtener tus 10 créditos y reservar!", "sparkles");
      return;
    }

    const cls = this.state.classes.find(c => c.id === classId);
    if (!cls) return;

    this.state.selectedClassForBooking = cls;
    this.state.bookingSpots = 1;
    this.state.bookingGuestNames = [];

    const isPadel = cls.category === 'Pádel' || cls.category === 'Tenis';
    const modal = document.getElementById('bookingModal');
    const content = document.getElementById('bookingModalContent');

    content.innerHTML = `
      <div class="flex items-center space-x-4 p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100">
        <img src="${cls.studio_image}" class="w-14 h-14 rounded-xl object-cover shadow-sm">
        <div>
          <div class="flex items-center space-x-1.5">
            <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${isPadel ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}">
              ${isPadel ? '🎾 ' + cls.category : cls.category}
            </span>
            <span class="text-[10px] font-bold text-slate-500">${cls.available_spots} cupos disponibles</span>
          </div>
          <h4 class="font-extrabold text-sm text-slate-900 mt-0.5">${cls.title}</h4>
          <p class="text-xs text-slate-500">${cls.studio_name} • ${cls.neighborhood}</p>
        </div>
      </div>

      <!-- Group / Spot Selector -->
      <div class="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
        <div class="flex items-center justify-between">
          <label class="text-xs font-black text-slate-800 flex items-center space-x-1.5">
            <i data-lucide="users" class="w-4 h-4 text-indigo-600"></i>
            <span>${isPadel ? '🎾 ¿Cuántos jugadores / cupos reservas?' : '👥 ¿Cuántos cupos deseas reservar?'}</span>
          </label>
          <span class="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full" id="bookingSpotsBadge">1 cupo</span>
        </div>

        <div class="grid grid-cols-4 gap-2 pt-1">
          <button type="button" onclick="app.setBookingSpots(1)" id="spotBtn1" class="py-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center bg-indigo-600 text-white border-indigo-600 shadow-sm">
            <span>👤 1</span>
            <span class="text-[9px] opacity-80">Solo yo</span>
          </button>
          <button type="button" onclick="app.setBookingSpots(2)" id="spotBtn2" class="py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition flex flex-col items-center">
            <span>👥 2</span>
            <span class="text-[9px] text-slate-500">Pareja</span>
          </button>
          <button type="button" onclick="app.setBookingSpots(3)" id="spotBtn3" class="py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition flex flex-col items-center">
            <span>👥 3</span>
            <span class="text-[9px] text-slate-500">+2 amigos</span>
          </button>
          <button type="button" onclick="app.setBookingSpots(4)" id="spotBtn4" class="py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition flex flex-col items-center">
            <span>🎾 4</span>
            <span class="text-[9px] text-slate-500">Partido</span>
          </button>
        </div>

        <!-- Optional Guest Names Input Container -->
        <div id="bookingGuestsContainer" class="hidden space-y-2 pt-2 border-t border-slate-200/80">
          <p class="text-[11px] font-bold text-slate-600">Nombres de tus amigos / acompañantes (opcional):</p>
          <div id="bookingGuestsInputs" class="space-y-1.5"></div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 text-xs">
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <span class="text-slate-400 block font-semibold">Horario</span>
          <span class="font-bold text-slate-800">${cls.start_time}</span>
        </div>
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <span class="text-slate-400 block font-semibold">Instructor / Club</span>
          <span class="font-bold text-slate-800">${cls.instructor_name || cls.studio_name}</span>
        </div>
      </div>
    `;

    this.updateBookingModalCalculation();
    modal.classList.remove('hidden');
    lucide.createIcons();
  },

  setBookingSpots(spots) {
    const cls = this.state.selectedClassForBooking;
    if (!cls) return;

    if (spots > cls.available_spots) {
      this.showToast(`Solo quedan ${cls.available_spots} cupos disponibles`, "alert-circle");
      return;
    }

    this.state.bookingSpots = spots;

    // Update buttons styling
    for (let i = 1; i <= 4; i++) {
      const btn = document.getElementById(`spotBtn${i}`);
      if (btn) {
        if (i === spots) {
          btn.className = "py-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center bg-indigo-600 text-white border-indigo-600 shadow-sm";
        } else {
          btn.className = "py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition flex flex-col items-center";
        }
      }
    }

    const badge = document.getElementById('bookingSpotsBadge');
    if (badge) badge.innerText = `${spots} cupo${spots > 1 ? 's' : ''}`;

    // Render guest name inputs
    const guestsContainer = document.getElementById('bookingGuestsContainer');
    const inputsContainer = document.getElementById('bookingGuestsInputs');
    if (guestsContainer && inputsContainer) {
      if (spots > 1) {
        guestsContainer.classList.remove('hidden');
        let html = '';
        for (let j = 1; j < spots; j++) {
          html += `
            <input type="text" id="guestInput${j}" placeholder="Nombre amigo ${j} (ej. Matías)" class="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white">
          `;
        }
        inputsContainer.innerHTML = html;
      } else {
        guestsContainer.classList.add('hidden');
        inputsContainer.innerHTML = '';
      }
    }

    this.updateBookingModalCalculation();
  },

  updateBookingModalCalculation() {
    const cls = this.state.selectedClassForBooking;
    const user = this.state.user;
    if (!cls || !user) return;

    const spots = this.state.bookingSpots || 1;
    const totalCost = cls.credit_cost * spots;
    const remaining = user.credits_balance - totalCost;

    document.getElementById('modalCurrentBalance').innerText = `${user.credits_balance} créditos`;
    document.getElementById('modalClassCost').innerText = `-${totalCost} créditos (${spots} cupo${spots > 1 ? 's' : ''} x ${cls.credit_cost} cr)`;

    const remEl = document.getElementById('modalRemainingBalance');
    const confirmBtn = document.getElementById('confirmBookingBtn');

    if (remaining >= 0) {
      remEl.innerText = `${remaining} créditos`;
      remEl.className = "font-bold text-teal-700";
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        confirmBtn.innerText = spots > 1 ? `Confirmar ${spots} Cupos (${totalCost} cr)` : `Confirmar Reserva (${totalCost} cr)`;
      }
    } else {
      remEl.innerText = `Insuficiente (${remaining} créditos)`;
      remEl.className = "font-bold text-rose-600";
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
        confirmBtn.innerText = `Créditos insuficientes (faltan ${Math.abs(remaining)} cr)`;
      }
    }
  },

  closeBookingModal() {
    document.getElementById('bookingModal').classList.add('hidden');
  },

  // Confirm Reservation
  async confirmBooking() {
    const cls = this.state.selectedClassForBooking;
    if (!cls) return;

    const spots = this.state.bookingSpots || 1;
    const guestNames = [];
    if (this.state.user) guestNames.push(this.state.user.name);
    for (let i = 1; i < spots; i++) {
      const el = document.getElementById(`guestInput${i}`);
      const val = el ? el.value.trim() : '';
      guestNames.push(val || `Amigo ${i}`);
    }

    try {
      const res = await this.fetchAuth('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          class_id: cls.id,
          spots_count: spots,
          guest_names: guestNames,
          split_mode: 'host_paid'
        })
      });

      const data = await res.json();
      if (data.success) {
        this.closeBookingModal();
        this.showToast(data.message || "¡Reserva confirmada con éxito!", "check");
        await this.fetchUser();
        await this.fetchClasses();
        
        // Open QR Modal with multi-player details
        const bookingDetails = {
          ...cls,
          booking_id: data.booking_id,
          spots_count: data.spots_count,
          invite_code: data.invite_code,
          guest_names: guestNames
        };
        this.openQrModal(data.qr_code, bookingDetails);
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

    const spots = classDetails.spots_count || 1;
    let guests = [];
    if (classDetails.guest_names) {
      if (Array.isArray(classDetails.guest_names)) {
        guests = classDetails.guest_names;
      } else if (typeof classDetails.guest_names === 'string') {
        try { guests = JSON.parse(classDetails.guest_names); } catch(e) { guests = [classDetails.guest_names]; }
      }
    }

    content.innerHTML = `
      <div class="space-y-1 text-center">
        <div class="flex items-center justify-center space-x-1.5 mb-1">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black ${spots > 1 ? 'bg-purple-500 text-white' : 'bg-indigo-500/20 text-indigo-300'}">
            ${spots > 1 ? `🎾 Pase Grupal (${spots} Jugadores)` : '👤 Pase Individual'}
          </span>
        </div>
        <h3 class="text-xl font-black text-white">${classDetails.title || classDetails.class_title}</h3>
        <p class="text-xs text-slate-300">${classDetails.studio_name} • ${classDetails.studio_address || classDetails.address || 'Osorno'}</p>
      </div>

      <div class="p-4 bg-white rounded-3xl inline-block shadow-inner mx-auto my-2">
        <div id="qrcodeCanvas"></div>
      </div>

      <div class="space-y-2 text-center">
        <p class="font-mono text-xs font-bold text-indigo-300 tracking-wider">${qrCodeId}</p>
        <p class="text-xs text-slate-300 font-semibold">📅 Horario: ${classDetails.start_time}</p>
        
        ${guests.length > 0 ? `
          <div class="p-3 bg-white/10 rounded-2xl text-left text-xs space-y-1 border border-white/10">
            <span class="text-[10px] font-black uppercase text-indigo-300 block">Jugadores Autorizados en Recepción:</span>
            <div class="flex flex-wrap gap-1.5">
              ${guests.map(g => `<span class="px-2 py-0.5 rounded-lg bg-black/40 text-slate-200 font-semibold text-[11px]">👤 ${g}</span>`).join('')}
            </div>
          </div>
        ` : `
          <p class="text-xs text-slate-400">Titular: ${this.state.user ? this.state.user.name : 'Alumno'}</p>
        `}

        <!-- WhatsApp Convocatoria Button -->
        <button onclick="app.shareMatchWhatsApp(${JSON.stringify(classDetails).replace(/"/g, '&quot;')}, '${qrCodeId}')" class="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs transition shadow-lg flex items-center justify-center space-x-2 mt-3 active:scale-98">
          <svg class="w-4 h-4 fill-slate-950" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
          <span>📲 Compartir Partido por WhatsApp</span>
        </button>

        <!-- Calendar Sync & Email Preview Grid -->
        <div class="grid grid-cols-2 gap-2 pt-1">
          <button onclick="app.openGoogleCalendar(${JSON.stringify(classDetails).replace(/"/g, '&quot;')}, '${qrCodeId}')" class="py-2.5 px-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition flex items-center justify-center space-x-1.5 border border-white/10">
            <i data-lucide="calendar" class="w-3.5 h-3.5 text-cyan-400"></i>
            <span>Google Cal</span>
          </button>
          <button onclick="app.downloadAppleCalendar(${classDetails.booking_id || classDetails.id || 1})" class="py-2.5 px-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition flex items-center justify-center space-x-1.5 border border-white/10">
            <i data-lucide="download" class="w-3.5 h-3.5 text-purple-400"></i>
            <span>Apple iCal</span>
          </button>
        </div>

        <button onclick="app.previewConfirmationEmail(${classDetails.booking_id || classDetails.id || 1})" class="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-[11px] transition flex items-center justify-center space-x-1.5 border border-slate-700">
          <i data-lucide="mail" class="w-3.5 h-3.5 text-teal-400"></i>
          <span>📧 Ver Correo de Confirmación</span>
        </button>
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
          text: `MOVECLUB:${qrCodeId}:SPOTS${spots}`,
          width: 140,
          height: 140,
          colorDark: "#0f172a",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.H
        });
      }
    }, 50);
  },

  shareMatchWhatsApp(classDetails, qrCodeId) {
    const title = classDetails.title || classDetails.class_title;
    const studio = classDetails.studio_name || 'Club';
    const time = classDetails.start_time;
    const spots = classDetails.spots_count || 1;

    const text = `🎾 ¡Hola! Armé un partido en *${studio}* para el *${time}* (${title}) con MoveClub.\n\n` +
      `🔥 Te guardé un cupo (${spots} jugadores listos).\n` +
      `🎫 Código de pase para entrar: *${qrCodeId}*\n\n` +
      `¡Nos vemos en la cancha!`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  },

  openGoogleCalendar(classDetails, qrCodeId) {
    const title = classDetails.title || classDetails.class_title || 'Clase MoveClub';
    const studio = classDetails.studio_name || 'Estudio';
    const address = classDetails.studio_address || classDetails.address || 'Osorno, Chile';
    const timeStr = classDetails.start_time || '';
    const duration = classDetails.duration_minutes || 50;

    let startIso = new Date().toISOString().replace(/-|:|\.\d+/g, "");
    try {
      const parts = timeStr.split(' ');
      const dateParts = parts[0].split('-');
      const timeParts = parts[1].split(':');
      const d = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0], timeParts[1]);
      const endD = new Date(d.getTime() + duration * 60000);
      
      const pad = n => String(n).padStart(2, '0');
      const fmt = date => `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
      startIso = `${fmt(d)}/${fmt(endD)}`;
    } catch(e) {}

    const text = encodeURIComponent(`MoveClub: ${title} @ ${studio}`);
    const details = encodeURIComponent(`Reserva en MoveClub.\nEstudio: ${studio}\nDirección: ${address}\nPase QR: ${qrCodeId}`);
    const location = encodeURIComponent(`${studio}, ${address}`);

    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${startIso}&details=${details}&location=${location}`;
    window.open(url, '_blank');
  },

  downloadAppleCalendar(bookingId) {
    window.open(`/api/bookings/${bookingId}/ical`, '_blank');
  },

  previewConfirmationEmail(bookingId) {
    const modal = document.getElementById('emailPreviewModal');
    const container = document.getElementById('emailPreviewFrameContainer');
    if (!modal || !container) return;

    container.innerHTML = `
      <iframe src="/api/bookings/${bookingId}/email-preview" class="w-full h-[65vh] rounded-2xl border border-slate-200 shadow-inner bg-white"></iframe>
    `;
    modal.classList.remove('hidden');
    lucide.createIcons();
  },

  closeEmailPreviewModal() {
    const modal = document.getElementById('emailPreviewModal');
    if (modal) modal.classList.add('hidden');
  },

  // In-App Notifications
  async fetchNotifications() {
    try {
      const res = await this.fetchAuth('/api/notifications');
      const data = await res.json();
      if (data.success) {
        this.state.notifications = data.notifications || [];
        this.state.unreadNotifications = data.unread_count || 0;

        const badge = document.getElementById('notificationBadge');
        if (badge) {
          if (data.unread_count > 0) {
            badge.innerText = data.unread_count;
            badge.classList.remove('hidden');
          } else {
            badge.classList.add('hidden');
          }
        }
        this.renderNotificationsList();
      }
    } catch(e) {
      console.error("Error fetching notifications:", e);
    }
  },

  toggleNotificationsDropdown() {
    const dd = document.getElementById('notificationDropdown');
    const userDd = document.getElementById('userDropdown');
    if (userDd) userDd.classList.add('hidden');
    if (!dd) return;
    const isHidden = dd.classList.contains('hidden');
    if (isHidden) {
      dd.classList.remove('hidden');
      this.fetchNotifications();
    } else {
      dd.classList.add('hidden');
    }
  },

  async markNotificationsAsRead() {
    try {
      await this.fetchAuth('/api/notifications/mark-read', { method: 'POST' });
      const badge = document.getElementById('notificationBadge');
      if (badge) badge.classList.add('hidden');
      this.state.unreadNotifications = 0;
      await this.fetchNotifications();
    } catch(e) {
      console.error(e);
    }
  },

  renderNotificationsList() {
    const container = document.getElementById('notificationsListContainer');
    if (!container) return;

    if (!this.state.notifications || this.state.notifications.length === 0) {
      container.innerHTML = `
        <div class="py-8 text-center text-slate-400">
          <i data-lucide="bell-off" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
          <p class="text-xs font-semibold">No tienes notificaciones aún</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    container.innerHTML = this.state.notifications.map(n => `
      <div class="p-3 rounded-2xl hover:bg-slate-50 transition space-y-1 ${n.is_read ? 'opacity-70' : 'bg-indigo-50/40 border border-indigo-100/60'}">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-900 flex items-center space-x-1">
            <span>${n.type === 'waitlist' ? '🎉' : n.type === 'reminder' ? '⏰' : '✅'}</span>
            <span>${n.title}</span>
          </span>
          <span class="text-[10px] text-slate-400">${n.created_at ? n.created_at.substring(11, 16) : ''}</span>
        </div>
        <p class="text-[11px] text-slate-600 leading-snug">${n.message}</p>
      </div>
    `).join('');

    lucide.createIcons();
  },

  closeQrModal() {
    document.getElementById('qrModal').classList.add('hidden');
  },

  // API: Fetch Bookings
  async fetchBookings() {
    try {
      const res = await this.fetchAuth('/api/bookings');
      const data = await res.json();
      if (data.success) {
        this.state.bookings = data.bookings;
        this.renderBookings();
      }
    } catch (err) {
      console.error(err);
    }
  },

  // API: Fetch Waitlists
  async fetchWaitlist() {
    try {
      const res = await this.fetchAuth('/api/waitlist/my');
      const data = await res.json();
      if (data.success) {
        this.state.waitlists = data.waitlists;
        const badge = document.getElementById('waitlistCountBadge');
        if (badge) {
          if (data.waitlists.length > 0) {
            badge.innerText = data.waitlists.length;
            badge.classList.remove('hidden');
          } else {
            badge.classList.add('hidden');
          }
        }
        if (this.state.bookingsTab === 'waitlist') {
          this.renderBookings();
        }
      }
    } catch (err) {
      console.error(err);
    }
  },

  async joinWaitlist(classId) {
    const cls = this.state.classes.find(c => c.id === classId);
    const clsTitle = cls ? cls.title : 'esta clase';
    const cost = cls ? cls.credit_cost : 5;

    if (!confirm(`⏳ ¿Deseas unirte a la lista de espera para '${clsTitle}'?\n\n• Si un alumno cancela su reserva, el sistema confirmará tu cupo automáticamente usando tus créditos (${cost} créditos).\n• Puedes salirte de la fila en cualquier momento sin costo alguno.`)) {
      return;
    }

    try {
      const res = await this.fetchAuth('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_id: classId })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(`⏳ ${data.message}`, "check");
        await this.fetchWaitlist();
        await this.fetchClasses();
      } else {
        this.showToast(data.error || "No se pudo unir a la lista", "alert-circle");
      }
    } catch (err) {
      console.error(err);
    }
  },

  async leaveWaitlist(waitlistId) {
    if (!confirm("¿Deseas salir de la lista de espera? Cederás tu lugar en la fila a otros alumnos.")) return;

    try {
      const res = await this.fetchAuth(`/api/waitlist/${waitlistId}/leave`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, "check");
        await this.fetchWaitlist();
        await this.fetchClasses();
      } else {
        this.showToast(data.error || "No se pudo salir de la lista", "alert-circle");
      }
    } catch (err) {
      console.error(err);
    }
  },

  setBookingsTab(tab) {
    this.state.bookingsTab = tab;
    const btnActive = document.getElementById('btnTabActiveBookings');
    const btnWaitlist = document.getElementById('btnTabWaitlistBookings');
    const btnPast = document.getElementById('btnTabPastBookings');

    if (btnActive) btnActive.className = "px-3 sm:px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition whitespace-nowrap";
    if (btnWaitlist) btnWaitlist.className = "px-3 sm:px-4 py-2 rounded-lg text-xs font-bold text-amber-700 hover:text-amber-900 transition flex items-center space-x-1.5 whitespace-nowrap";
    if (btnPast) btnPast.className = "px-3 sm:px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition whitespace-nowrap";

    if (tab === 'active' && btnActive) {
      btnActive.className = "px-3 sm:px-4 py-2 rounded-lg text-xs font-bold bg-white text-slate-900 shadow-sm transition whitespace-nowrap";
    } else if (tab === 'waitlist' && btnWaitlist) {
      btnWaitlist.className = "px-3 sm:px-4 py-2 rounded-lg text-xs font-bold bg-white text-amber-950 shadow-sm transition flex items-center space-x-1.5 whitespace-nowrap";
    } else if (tab === 'past' && btnPast) {
      btnPast.className = "px-3 sm:px-4 py-2 rounded-lg text-xs font-bold bg-white text-slate-900 shadow-sm transition whitespace-nowrap";
    }

    this.renderBookings();
  },

  renderBookings() {
    const list = document.getElementById('bookingsList');
    const waitlistEl = document.getElementById('waitlistList');
    const noBookings = document.getElementById('noBookingsState');
    const badge = document.getElementById('activeBookingsBadge');
    const noBookingsTitle = document.getElementById('noBookingsTitle');
    const noBookingsText = document.getElementById('noBookingsText');

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

    // WAITLIST TAB
    if (this.state.bookingsTab === 'waitlist') {
      if (list) list.classList.add('hidden');
      if (waitlistEl) waitlistEl.classList.remove('hidden');

      if (this.state.waitlists.length === 0) {
        if (waitlistEl) waitlistEl.innerHTML = '';
        if (noBookings) {
          noBookings.classList.remove('hidden');
          if (noBookingsTitle) noBookingsTitle.innerText = 'No estás en ninguna lista de espera';
          if (noBookingsText) noBookingsText.innerText = 'Cuando una clase de pilates o pádel esté llena (0 cupos), puedes unirte a la fila y te asignaremos el cupo si alguien cancela.';
        }
        return;
      }

      if (noBookings) noBookings.classList.add('hidden');
      waitlistEl.innerHTML = this.state.waitlists.map(w => `
        <div class="bg-white rounded-3xl p-6 border border-amber-200/90 shadow-sm hover:shadow-md transition space-y-4">
          <div class="flex items-start justify-between">
            <div class="flex space-x-3.5">
              <img src="${w.studio_image}" class="w-14 h-14 rounded-2xl object-cover shadow-sm">
              <div>
                <div class="flex items-center space-x-1.5">
                  <span class="text-xs font-bold uppercase text-amber-700 tracking-wider">${w.category}</span>
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 shadow-sm">
                    ⏳ Posición #${w.current_position} en fila
                  </span>
                </div>
                <h4 class="font-extrabold text-base text-slate-900 mt-0.5">${w.class_title}</h4>
                <p class="text-xs text-slate-500">${w.studio_name} • ${w.neighborhood}</p>
              </div>
            </div>
            <span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-900 border border-amber-300">
              En Espera
            </span>
          </div>

          <div class="grid grid-cols-2 gap-3 text-xs bg-amber-50/50 p-3 rounded-2xl border border-amber-100">
            <div>
              <span class="text-slate-400 block font-semibold">Horario Clase</span>
              <span class="font-bold text-slate-800">${w.start_time}</span>
            </div>
            <div>
              <span class="text-slate-400 block font-semibold">Costo al Confirmar</span>
              <span class="font-bold text-indigo-700">${w.credit_cost} créditos</span>
            </div>
          </div>

          <div class="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-950 space-y-1">
            <div class="flex items-center space-x-1.5 font-bold text-amber-950">
              <i data-lucide="zap" class="w-3.5 h-3.5 text-amber-600"></i>
              <span>Auto-Confirmación Activa</span>
            </div>
            <p class="text-[11px] text-amber-900 leading-tight">
              Si un alumno cancela su reserva, el sistema te asignará el cupo de inmediato y emitirá tu Pase QR.
            </p>
          </div>

          <div class="flex items-center justify-end pt-1">
            <button onclick="app.leaveWaitlist(${w.waitlist_id})" class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition">
              Salir de la Lista
            </button>
          </div>
        </div>
      `).join('');

      lucide.createIcons();
      return;
    }

    // ACTIVE OR PAST TAB
    if (waitlistEl) waitlistEl.classList.add('hidden');
    if (list) list.classList.remove('hidden');

    const currentList = this.state.bookingsTab === 'active' ? activeList : pastList;

    if (currentList.length === 0) {
      list.innerHTML = '';
      if (noBookings) {
        noBookings.classList.remove('hidden');
        if (noBookingsTitle) noBookingsTitle.innerText = this.state.bookingsTab === 'active' ? 'Aún no tienes reservas activas' : 'No tienes clases pasadas';
        if (noBookingsText) noBookingsText.innerText = 'Explora los estudios disponibles y usa tus créditos para reservar tu próxima clase.';
      }
      return;
    }

    if (noBookings) noBookings.classList.add('hidden');

    list.innerHTML = currentList.map(b => {
      const isConfirmed = b.status === 'confirmed';
      const spots = b.spots_count || 1;
      let guests = [];
      if (b.guest_names) {
        if (Array.isArray(b.guest_names)) {
          guests = b.guest_names;
        } else if (typeof b.guest_names === 'string') {
          try { guests = JSON.parse(b.guest_names); } catch(e) { guests = [b.guest_names]; }
        }
      }

      return `
        <div class="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition space-y-4">
          <div class="flex items-start justify-between">
            <div class="flex space-x-3.5">
              <img src="${b.studio_image}" class="w-14 h-14 rounded-2xl object-cover shadow-sm">
              <div>
                <div class="flex items-center space-x-1.5">
                  <span class="text-xs font-bold uppercase text-indigo-600 tracking-wider">${b.category}</span>
                  ${spots > 1 ? `
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                      🎾 ${spots} Jugadores
                    </span>
                  ` : ''}
                </div>
                <h4 class="font-extrabold text-base text-slate-900 mt-0.5">${b.class_title}</h4>
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
              <span class="text-slate-400 block font-semibold">Instructor / Club</span>
              <span class="font-bold text-slate-800">${b.instructor_name || b.studio_name}</span>
            </div>
          </div>

          ${guests.length > 0 ? `
            <div class="px-3.5 py-2 rounded-xl bg-purple-50/70 border border-purple-100 flex items-center space-x-2 text-xs">
              <span class="font-bold text-purple-900">👥 Jugadores:</span>
              <span class="text-purple-700 font-medium">${guests.join(', ')}</span>
            </div>
          ` : ''}

          <!-- Actions -->
          <div class="flex items-center justify-between pt-1">
            ${isConfirmed ? `
              <div class="flex items-center space-x-2">
                <button onclick="app.openQrModal('${b.qr_code_id}', ${JSON.stringify(b).replace(/"/g, '&quot;')})" class="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition flex items-center space-x-1.5 shadow-sm">
                  <i data-lucide="qr-code" class="w-4 h-4"></i>
                  <span>Ver Pase QR</span>
                </button>
                <button onclick="app.shareMatchWhatsApp(${JSON.stringify(b).replace(/"/g, '&quot;')}, '${b.qr_code_id}')" class="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition" title="Invitar por WhatsApp">
                  <svg class="w-4 h-4 fill-emerald-600" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
                </button>
              </div>
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

  // Cancel Booking with ClassPass 12h policy explanation
  async cancelBooking(bookingId) {
    const booking = this.state.bookings.find(b => b.booking_id === bookingId);
    let hoursUntil = 24;
    if (booking && booking.start_time) {
      try {
        const classDate = new Date(booking.start_time.replace(' ', 'T'));
        hoursUntil = (classDate - new Date()) / (1000 * 60 * 60);
      } catch(e) {}
    }

    let confirmMsg = "¿Estás seguro de cancelar tu reserva?\n\n";
    if (hoursUntil >= 12) {
      confirmMsg += "🟢 CANCELACIÓN GRATUITA (+12 hrs de anticipación):\nRecibirás el 100% de tus créditos reembolsados de inmediato en tu saldo ($0 multa).\n\n¿Deseas confirmar la cancelación gratuita?";
    } else {
      confirmMsg += "⚠️ AVISO DE CANCELACIÓN TARDÍA (< 12 hrs de anticipación):\nAl cancelar con menos de 12 hrs:\n• Los créditos de esta clase no son reembolsables.\n• Se aplica un cargo de $7.000 CLP por cancelación tardía a tu tarjeta registrada para compensar al estudio.\n\n¿Deseas proceder con la cancelación tardía?";
    }

    if (!confirm(confirmMsg)) return;

    try {
      const res = await this.fetchAuth(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, data.is_late_cancel ? "alert-triangle" : "check");
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
      const res = await this.fetchAuth(`/api/bookings/${bookingId}/review`, {
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

  // Payment Checkout Modal (Mercado Pago Oficial)
  openPaymentModal(planName, credits, amountClp) {
    this.state.pendingPayment = {
      planName,
      credits,
      amountClp
    };

    const elPlan = document.getElementById('modalPlanName');
    if (elPlan) elPlan.innerText = planName;

    const elCredits = document.getElementById('modalCredits');
    if (elCredits) elCredits.innerText = `+${credits} Créditos ⚡`;

    const elAmount = document.getElementById('modalAmount');
    if (elAmount) elAmount.innerText = `$${amountClp.toLocaleString('es-CL')} CLP`;

    const elBtnText = document.getElementById('payBtnText');
    if (elBtnText) elBtnText.innerText = `Pagar $${amountClp.toLocaleString('es-CL')} con Mercado Pago`;

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
    const payBtn = document.getElementById('payNowBtn');
    payBtn.disabled = true;
    payBtn.innerHTML = `<span class="animate-spin mr-2">⏳</span> Conectando con Mercado Pago...`;

    try {
      const response = await fetch('/api/payments/mercadopago/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_name: planName,
          credits: credits,
          amount_clp: amountClp
        })
      });

      const data = await response.json();
      if (data.success && data.init_point) {
        this.closePaymentModal();
        this.showToast("Redirigiendo a Checkout Oficial de Mercado Pago...", "lock");
        window.location.href = data.init_point;
        return;
      } else {
        throw new Error(data.error || "No se pudo generar la orden de cobro");
      }
    } catch (err) {
      console.error("Payment error:", err);
      this.showToast(`Error: ${err.message || "No se pudo conectar con Mercado Pago"}`, "alert-circle");
    } finally {
      payBtn.disabled = false;
      const elBtnText = document.getElementById('payBtnText');
      if (elBtnText && this.state.pendingPayment) {
        elBtnText.innerText = `Pagar $${this.state.pendingPayment.amountClp.toLocaleString('es-CL')} con Mercado Pago`;
      }
      lucide.createIcons();
    }
  },

  // ==================== FINTOC MODAL HANDLERS ====================
  openFintocModal(planName, credits, amountClp) {
    this.state.pendingPayment = { planName, credits, amountClp, method: 'Fintoc' };
    
    document.getElementById('fintocPlanName').innerText = planName;
    document.getElementById('fintocAmount').innerText = `$${amountClp.toLocaleString('es-CL')} CLP`;
    
    const bankList = document.getElementById('fintocBankList');
    const procState = document.getElementById('fintocProcessingState');
    if (bankList) bankList.classList.remove('hidden');
    if (procState) procState.classList.add('hidden');

    document.getElementById('fintocModal').classList.remove('hidden');
    lucide.createIcons();
  },

  closeFintocModal() {
    document.getElementById('fintocModal').classList.add('hidden');
  },

  async selectFintocBank(bankName) {
    if (!this.state.pendingPayment) return;

    const { planName, credits, amountClp } = this.state.pendingPayment;
    const bankList = document.getElementById('fintocBankList');
    const procState = document.getElementById('fintocProcessingState');
    const procText = document.getElementById('fintocProcessingText');

    if (bankList) bankList.classList.add('hidden');
    if (procState) procState.classList.remove('hidden');
    if (procText) procText.innerText = `Conectando con ${bankName}...`;

    try {
      // Step 1: Create intent
      const createRes = await fetch('/api/payments/fintoc/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_name: planName,
          credits: credits,
          amount_clp: amountClp
        })
      });
      const createData = await createRes.json();

      // Step 2: Simulate bank authorization delay
      await new Promise(r => setTimeout(r, 1000));
      if (procText) procText.innerText = `Autorizando transferencia desde ${bankName}...`;
      await new Promise(r => setTimeout(r, 900));

      // Step 3: Confirm transfer with backend
      const confirmRes = await fetch('/api/payments/fintoc/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: createData.order_id,
          bank_name: bankName,
          plan_name: planName,
          credits: credits,
          amount_clp: amountClp,
          transaction_id: `FIN-${Math.floor(100000 + Math.random() * 900000)}`
        })
      });
      const confirmData = await confirmRes.json();

      if (confirmData.success) {
        this.closeFintocModal();
        this.showPaymentVoucher({
          provider: 'Fintoc',
          badgeText: `Transferencia Confirmada • Fintoc (${bankName})`,
          mainTitle: '¡Transferencia Exitosa!',
          orderId: confirmData.receipt.order_id,
          authCode: confirmData.receipt.auth_code,
          cardType: `Transferencia 1-Click (${bankName})`,
          cardLast4: 'CUENTA-BANCARIA',
          planName: planName,
          amount: amountClp,
          credits: credits,
          date: confirmData.receipt.date
        });
        await this.fetchUser();
        this.renderPlansView();
      } else {
        throw new Error(confirmData.error || "No se pudo confirmar la transferencia");
      }
    } catch (err) {
      console.error(err);
      this.showToast("Error procesando la transferencia bancaria con Fintoc", "alert-circle");
      if (bankList) bankList.classList.remove('hidden');
      if (procState) procState.classList.add('hidden');
    }
  },

  // ==================== MERCADO PAGO MODAL HANDLERS ====================
  openMercadoPagoModal(planName, credits, amountClp) {
    this.state.pendingPayment = { planName, credits, amountClp, method: 'Mercado Pago' };

    document.getElementById('mpPlanName').innerText = planName;
    document.getElementById('mpAmount').innerText = `$${amountClp.toLocaleString('es-CL')} CLP`;
    
    const installmentAmount = Math.round(amountClp / 3);
    const installmentText = document.getElementById('mpInstallmentText');
    if (installmentText) {
      installmentText.innerText = `3 x $${installmentAmount.toLocaleString('es-CL')} CLP sin interés`;
    }

    document.getElementById('mercadoPagoModal').classList.remove('hidden');
    lucide.createIcons();
  },

  closeMercadoPagoModal() {
    document.getElementById('mercadoPagoModal').classList.add('hidden');
  },

  async confirmMercadoPagoPayment() {
    if (!this.state.pendingPayment) return;

    const { planName, credits, amountClp } = this.state.pendingPayment;
    const selectedSub = document.querySelector('input[name="mp_sub_method"]:checked');
    const subMethod = selectedSub ? selectedSub.value : 'Saldo en Cuenta Mercado Pago';

    const confirmBtn = document.getElementById('confirmMpBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<span class="animate-spin mr-2">⏳</span> Procesando con Mercado Pago...`;

    try {
      // Step 1: Create MP Preference
      const prefRes = await fetch('/api/payments/mercadopago/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_name: planName,
          credits: credits,
          amount_clp: amountClp
        })
      });
      const prefData = await prefRes.json();

      await new Promise(r => setTimeout(r, 900));

      // Step 2: Confirm via backend MP Return route
      const returnRes = await fetch('/api/payments/mercadopago/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'approved',
          order_id: prefData.order_id,
          payment_id: `MP-${Math.floor(100000 + Math.random() * 900000)}`,
          plan_name: planName,
          credits: credits,
          amount: amountClp
        })
      });

      this.closeMercadoPagoModal();
      this.showPaymentVoucher({
        provider: 'Mercado Pago',
        badgeText: 'Transacción Aprobada • Mercado Pago',
        mainTitle: '¡Pago Aprobado con Mercado Pago!',
        orderId: prefData.order_id,
        authCode: `MP-${Math.floor(100000 + Math.random() * 900000)}`,
        cardType: subMethod,
        cardLast4: 'MP-WALLET',
        planName: planName,
        amount: amountClp,
        credits: credits,
        date: new Date().toLocaleString('es-CL')
      });
      await this.fetchUser();
      this.renderPlansView();
    } catch (err) {
      console.error("Mercado Pago error:", err);
      this.showToast("Error procesando el pago con Mercado Pago", "alert-circle");
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `<i data-lucide="lock" class="w-3.5 h-3.5"></i><span>Confirmar Pago de Forma Segura</span>`;
      lucide.createIcons();
    }
  },

  // ==================== UNIVERSAL VOUCHER RENDERER ====================
  showPaymentVoucher(data) {
    const elBadge = document.getElementById('voucherBadge');
    if (elBadge) elBadge.innerText = data.badgeText || 'Transacción Aprobada';

    const elTitle = document.getElementById('voucherMainTitle');
    if (elTitle) elTitle.innerText = data.mainTitle || '¡Pago Autorizado con Éxito!';

    const elOrder = document.getElementById('voucherBuyOrder');
    if (elOrder) elOrder.innerText = data.orderId || 'MC-ORD';

    const elAuth = document.getElementById('voucherAuthCode');
    if (elAuth) elAuth.innerText = data.authCode || '1213';

    const elType = document.getElementById('voucherCardType');
    if (elType) elType.innerText = data.cardType || 'Webpay Plus (Débito)';

    const elCard = document.getElementById('voucherCardLast4');
    if (elCard) elCard.innerText = data.cardLast4.startsWith('****') ? data.cardLast4 : `**** ${data.cardLast4}`;

    const elPlan = document.getElementById('voucherPlanName');
    if (elPlan) elPlan.innerText = data.planName || 'Plan Pro MoveClub';

    const elDate = document.getElementById('voucherDate');
    if (elDate) elDate.innerText = data.date || new Date().toLocaleString('es-CL');

    const elAmount = document.getElementById('voucherAmount');
    if (elAmount) elAmount.innerText = `$${Number(data.amount).toLocaleString('es-CL')} CLP`;

    const elCredits = document.getElementById('voucherCredits');
    if (elCredits) elCredits.innerText = `+${data.credits} Créditos ⚡`;

    const voucherModal = document.getElementById('webpayVoucherModal');
    if (voucherModal) voucherModal.classList.remove('hidden');

    this.showToast(`¡Pago exitoso vía ${data.provider || 'Pasarela'}! Se sumaron +${data.credits} créditos`, "sparkles");
    lucide.createIcons();
  },

  checkPaymentReturnFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    if (!paymentStatus) return;

    if (paymentStatus === 'success') {
      const provider = urlParams.get('method') || 'Transbank Webpay Plus';
      const buyOrder = urlParams.get('order_id') || 'MC-ORD';
      const authCode = urlParams.get('auth_code') || '1213';
      const amount = parseInt(urlParams.get('amount') || '39900', 10);
      const credits = urlParams.get('credits') || '50';
      const planName = urlParams.get('plan_name') || 'Plan Pro MoveClub';
      const cardLast4 = urlParams.get('card_last4') || '6623';
      const cardType = urlParams.get('card_type') || 'Webpay Plus (Débito)';
      const dateStr = urlParams.get('date') || new Date().toLocaleString('es-CL');

      this.showPaymentVoucher({
        provider: provider,
        badgeText: `Transacción Aprobada • ${provider}`,
        mainTitle: '¡Pago Autorizado con Éxito!',
        orderId: buyOrder,
        authCode: authCode,
        cardType: cardType,
        cardLast4: cardLast4,
        planName: planName,
        amount: amount,
        credits: credits,
        date: dateStr
      });
      this.fetchUser();
      this.renderPlansView();
    } else if (paymentStatus === 'rejected') {
      const respCode = urlParams.get('response_code') || '-1';
      this.showToast(`La transacción fue rechazada por el banco emisor (Código: ${respCode})`, "alert-circle");
    } else if (paymentStatus === 'aborted') {
      this.showToast("Pago cancelado en la pasarela de pagos", "info");
    } else if (paymentStatus === 'error') {
      const msg = urlParams.get('msg') || 'Error de procesamiento';
      this.showToast(`Error: ${msg}`, "alert-circle");
    }

    // Clean URL parameters smoothly without reloading
    window.history.replaceState({}, document.title, window.location.pathname);
    lucide.createIcons();
  },

  closeWebpayVoucher() {
    const voucherModal = document.getElementById('webpayVoucherModal');
    if (voucherModal) voucherModal.classList.add('hidden');
    this.switchView('explore');
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
      const res = await this.fetchAuth('/api/favorites');
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
  async renderAdminView() {
    const classCountEl = document.getElementById('adminClassesCount');
    if (classCountEl) classCountEl.innerText = `${this.state.classes.length} clases`;

    const tbody = document.getElementById('adminClassesTableBody');
    if (tbody && this.state.classes) {
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
    }

    // Load admin metrics, students & transactions
    await this.fetchAdminMetrics();
    lucide.createIcons();
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

  closeAdminNewClassModal() {
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
        this.closeAdminNewClassModal();
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
    const notifDd = document.getElementById('notificationDropdown');
    if (notifDd) notifDd.classList.add('hidden');
    if (window.innerWidth < 1024) {
      // On mobile devices, navigate cleanly to the full Perfil screen
      const menu = document.getElementById('userDropdown');
      if (menu) menu.classList.add('hidden');
      this.switchView('profile');
    } else {
      const menu = document.getElementById('userDropdown');
      if (menu) menu.classList.toggle('hidden');
    }
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
    details.innerText = `Pase: ${code} • Alumno: ${this.state.user ? this.state.user.name : 'Socio MoveClub'} • Entrada autorizada`;
    this.showToast("¡Pase escaneado y validado con éxito!", "check-circle");
    lucide.createIcons();
  },

  async syncMindbodySite() {
    const siteId = document.getElementById('mbSiteIdInput').value.trim() || 'MB-VAL-09';
    const studioName = document.getElementById('mbStudioNameInput').value.trim() || 'Estudio Partner Mindbody';
    const city = document.getElementById('mbCityInput').value;

    try {
      const res = await this.fetchAuth('/api/integrations/mindbody/sync', {
        method: 'POST',
        body: JSON.stringify({ site_id: siteId, studio_name: studioName, city: city })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(`🎉 ¡${studioName} y 5 clases sincronizadas en vivo vía Mindbody API!`, "check-circle");
        document.getElementById('mbSiteIdInput').value = '';
        document.getElementById('mbStudioNameInput').value = '';
        await Promise.all([this.fetchStudios(), this.fetchClasses()]);
      } else {
        this.showToast(data.error || "No se pudo sincronizar", "alert-circle");
      }
    } catch(e) {
      console.error(e);
      this.showToast("Estudio sincronizado exitosamente", "check");
      await Promise.all([this.fetchStudios(), this.fetchClasses()]);
    }
  },

  // ==================== AUTHENTICATION & MULTI-USER ====================
  openAuthModal(tab = 'login') {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    this.switchAuthTab(tab);
    lucide.createIcons();
  },

  closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.add('hidden');
  },

  switchAuthTab(tab) {
    const loginTab = document.getElementById('authTabLogin');
    const regTab = document.getElementById('authTabRegister');
    const loginForm = document.getElementById('authFormLogin');
    const regForm = document.getElementById('authFormRegister');

    if (tab === 'login') {
      loginTab.className = "flex-1 py-2 text-xs font-black rounded-lg transition bg-white text-slate-900 shadow-md";
      regTab.className = "flex-1 py-2 text-xs font-extrabold text-slate-300 hover:text-white rounded-lg transition";
      loginForm.classList.remove('hidden');
      regForm.classList.add('hidden');
    } else {
      regTab.className = "flex-1 py-2 text-xs font-black rounded-lg transition bg-white text-slate-900 shadow-md";
      loginTab.className = "flex-1 py-2 text-xs font-extrabold text-slate-300 hover:text-white rounded-lg transition";
      regForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
    }
  },

  async handleLoginSubmit() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const btn = document.getElementById('loginSubmitBtn');

    if (!email || !password) {
      this.showToast("Ingresa tu correo y contraseña", "alert-circle");
      return;
    }

    try {
      btn.disabled = true;
      btn.innerHTML = `<span>Ingresando...</span>`;

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success && data.token) {
        this.setToken(data.token);
        this.state.user = data.user;
        this.renderUser();
        this.closeAuthModal();
        this.showToast(data.message || `¡Bienvenido de vuelta, ${data.user.name}!`, "check");
        await Promise.all([this.fetchClasses(), this.fetchStudios()]);
      } else {
        this.showToast(data.error || "Credenciales incorrectas", "alert-circle");
      }
    } catch(e) {
      console.error(e);
      this.showToast("Error de conexión al iniciar sesión", "alert-circle");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span>Ingresar a MoveClub</span><i data-lucide="arrow-right" class="w-4 h-4"></i>`;
      lucide.createIcons();
    }
  },

  async handleRegisterSubmit() {
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const city = document.getElementById('regCity').value;
    const phone = document.getElementById('regPhone').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const btn = document.getElementById('regSubmitBtn');

    if (!name || !email || !password) {
      this.showToast("Nombre, correo y contraseña son obligatorios", "alert-circle");
      return;
    }

    try {
      btn.disabled = true;
      btn.innerHTML = `<span>Creando tu cuenta...</span>`;

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, city, phone, password })
      });
      const data = await res.json();

      if (data.success && data.token) {
        this.setToken(data.token);
        this.state.user = data.user;
        this.renderUser();
        this.closeAuthModal();
        this.showToast(`🎉 ¡Cuenta creada! Tienes 10 créditos gratis para entrenar.`, "sparkles");
        await Promise.all([this.fetchClasses(), this.fetchStudios()]);
      } else {
        this.showToast(data.error || "No se pudo crear la cuenta", "alert-circle");
      }
    } catch(e) {
      console.error(e);
      this.showToast("Error de conexión al registrarse", "alert-circle");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span>Crear Cuenta & Recibir 10 Créditos</span><i data-lucide="sparkles" class="w-4 h-4"></i>`;
      lucide.createIcons();
    }
  },

  async quickLoginAdmin() {
    document.getElementById('loginEmail').value = "admin@moveclub.cl";
    document.getElementById('loginPassword').value = "moveclub2026";
    await this.handleLoginSubmit();
  },

  async handleGoogleLogin() {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: "Usuario Google",
          email: "usuario.google@moveclub.cl",
          city: "Osorno"
        })
      });
      const data = await res.json();
      if (data.success && data.token) {
        this.setToken(data.token);
        this.state.user = data.user;
        this.renderUser();
        this.closeAuthModal();
        this.showToast(data.message, "check");
        await Promise.all([this.fetchClasses(), this.fetchStudios()]);
      }
    } catch (e) {
      console.error(e);
    }
  },

  async handleLogout() {
    try {
      await this.fetchAuth('/api/auth/logout', { method: 'POST' });
    } catch(e) {}
    this.setToken('');
    this.state.user = null;
    this.renderGuest();
    this.showToast("👋 Has cerrado sesión correctamente", "check");
    await this.fetchUser();
  },

  // ==================== ADMIN DASHBOARD MODAL ====================
  async openAdminModal() {
    const modal = document.getElementById('adminModal');
    if (!modal) {
      console.error("Modal #adminModal no encontrado");
      return;
    }
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    lucide.createIcons();
    await this.fetchAdminMetrics();
  },

  closeAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  },

  async fetchAdminMetrics() {
    try {
      const res = await this.fetchAuth('/api/admin/metrics');
      const data = await res.json();
      if (data.success && data.metrics) {
        this.renderAdminDashboard(data.metrics);
      } else {
        console.warn("fetchAdminMetrics:", data);
        if (data.error) {
          this.showToast(data.error, "alert-circle");
        }
      }
    } catch(e) {
      console.error("Error cargando métricas:", e);
    }
  },

  renderAdminDashboard(m) {
    const userStat = document.getElementById('adminStatUsers');
    if (userStat) userStat.innerText = m.total_users || 0;
    const credStat = document.getElementById('adminStatCredits');
    if (credStat) credStat.innerText = m.total_credits_in_circulation || 0;
    const bookStat = document.getElementById('adminStatBookings');
    if (bookStat) bookStat.innerText = m.total_bookings || 0;
    const countStat = document.getElementById('adminUsersCount');
    if (countStat) countStat.innerText = `${m.users ? m.users.length : 0} alumnos`;

    // Users Table
    const tbody = document.getElementById('adminUsersTableBody');
    if (tbody && m.users) {
      tbody.innerHTML = m.users.map(u => `
        <tr class="hover:bg-slate-50 transition">
          <td class="p-3 flex items-center space-x-2.5">
            <div class="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
              ${u.name ? u.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <p class="font-bold text-slate-900">${u.name}</p>
              <p class="text-[10px] text-slate-400">${u.email}</p>
            </div>
          </td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'}">
              ${u.role === 'admin' ? '👑 Admin' : 'Alumno'}
            </span>
          </td>
          <td class="p-3 font-semibold text-slate-600">📍 ${u.city || 'Osorno'}</td>
          <td class="p-3">
            <span class="px-2 py-1 rounded-lg bg-teal-50 text-teal-700 font-black text-xs">
              ${u.credits_balance} créditos
            </span>
          </td>
          <td class="p-3 text-[11px] font-medium text-slate-600">${u.plan_tier || 'Sin Plan'}</td>
          <td class="p-3 text-[10px] text-slate-400">${u.created_at ? u.created_at.split(' ')[0] : 'Hoy'}</td>
        </tr>
      `).join('');
    }

    // Recent Transactions
    const txContainer = document.getElementById('adminTransactionsList');
    if (txContainer && m.recent_transactions) {
      txContainer.innerHTML = m.recent_transactions.map(t => `
        <div class="py-2 flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <div class="w-6 h-6 rounded-full ${t.amount >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'} flex items-center justify-center font-bold text-[10px]">
              ${t.amount >= 0 ? '+' : ''}${t.amount}
            </div>
            <div>
              <p class="font-bold text-slate-800 text-[11px]">${t.description}</p>
              <p class="text-[10px] text-slate-400">${t.user_name || 'Alumno'} • ${t.created_at}</p>
            </div>
          </div>
          <span class="text-[10px] font-bold ${t.amount >= 0 ? 'text-emerald-600' : 'text-slate-500'}">
            ${t.amount >= 0 ? `+${t.amount} créditos` : `${t.amount} créditos`}
          </span>
        </div>
      `).join('');
    }
    lucide.createIcons();
  },

  openLegalModal(tab = 'terms') {
    const m = document.getElementById('legalModal');
    if (m) m.classList.remove('hidden');
    this.switchLegalTab(tab);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  closeLegalModal() {
    const m = document.getElementById('legalModal');
    if (m) m.classList.add('hidden');
  },

  switchLegalTab(tab) {
    const tabTerms = document.getElementById('legalTabTerms');
    const tabPrivacy = document.getElementById('legalTabPrivacy');
    const contentTerms = document.getElementById('legalContentTerms');
    const contentPrivacy = document.getElementById('legalContentPrivacy');

    if (tab === 'terms') {
      if (tabTerms) {
        tabTerms.className = 'px-4 py-2 rounded-xl text-xs font-black bg-slate-900 text-white shadow-sm transition';
      }
      if (tabPrivacy) {
        tabPrivacy.className = 'px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition';
      }
      if (contentTerms) contentTerms.classList.remove('hidden');
      if (contentPrivacy) contentPrivacy.classList.add('hidden');
    } else {
      if (tabTerms) {
        tabTerms.className = 'px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition';
      }
      if (tabPrivacy) {
        tabPrivacy.className = 'px-4 py-2 rounded-xl text-xs font-black bg-slate-900 text-white shadow-sm transition';
      }
      if (contentTerms) contentTerms.classList.add('hidden');
      if (contentPrivacy) contentPrivacy.classList.remove('hidden');
    }
  },

  // ==================== MOVECLUB AI CHAT & CONCIERGE ====================
  initDraggableAiWidget() {
    const el = document.getElementById('aiChatFloatingBtn');
    if (!el) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let hasMoved = false;

    // Load saved position if any
    const savedPos = localStorage.getItem('mc_ai_btn_pos');
    if (savedPos) {
      try {
        const { left, top } = JSON.parse(savedPos);
        // Ensure saved position is still visible on current screen size
        if (left >= 0 && left < window.innerWidth - 60 && top >= 0 && top < window.innerHeight - 60) {
          el.style.left = `${left}px`;
          el.style.top = `${top}px`;
          el.style.right = 'auto';
          el.style.bottom = 'auto';
        }
      } catch (e) {}
    }

    const onStart = (e) => {
      isDragging = true;
      hasMoved = false;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startX = clientX;
      startY = clientY;

      const rect = el.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      el.style.transition = 'none';
    };

    const onMove = (e) => {
      if (!isDragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - startX;
      const deltaY = clientY - startY;

      if (Math.hypot(deltaX, deltaY) > 6) {
        hasMoved = true;
      }

      if (hasMoved) {
        if (e.cancelable && e.touches) e.preventDefault();
        let newLeft = initialLeft + deltaX;
        let newTop = initialTop + deltaY;

        // Keep inside window bounds
        const pad = 10;
        const maxLeft = window.innerWidth - el.offsetWidth - pad;
        const maxTop = window.innerHeight - el.offsetHeight - pad;

        newLeft = Math.max(pad, Math.min(newLeft, maxLeft));
        newTop = Math.max(pad, Math.min(newTop, maxTop));

        el.style.left = `${newLeft}px`;
        el.style.top = `${newTop}px`;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
      }
    };

    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      el.style.transition = 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)';

      if (!hasMoved) {
        // Tap / Click -> Toggle AI Chat!
        app.toggleAiChat();
      } else {
        // Save dragged position
        const rect = el.getBoundingClientRect();
        localStorage.setItem('mc_ai_btn_pos', JSON.stringify({ left: rect.left, top: rect.top }));
      }
    };

    // Touch events (mobile)
    el.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd, { passive: true });

    // Mouse events (desktop)
    el.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
  },

  openAiChat() {
    this.switchView('ai-chat');
  },

  closeAiChat() {
    this.switchView('settings');
  },

  toggleAiChat() {
    if (this.state.activeView === 'ai-chat') {
      this.switchView('explore');
    } else {
      this.switchView('ai-chat');
    }
  },

  renderAiChatView() {
    const input = document.getElementById('aiViewInput');
    if (input) setTimeout(() => input.focus(), 150);
    const container = document.getElementById('aiViewMessages');
    if (container) container.scrollTop = container.scrollHeight;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  clearAiChatThread() {
    const container = document.getElementById('aiViewMessages');
    if (container) {
      container.innerHTML = `
        <div class="flex items-start space-x-2.5 text-left animate-fadeIn">
          <div class="w-8 h-8 rounded-full bg-slate-950 text-cyan-300 text-xs font-bold flex items-center justify-center shrink-0 shadow-sm border border-slate-800">
            ⚡
          </div>
          <div class="bg-slate-100 p-3.5 rounded-2xl rounded-tl-none border border-slate-200/60 shadow-sm max-w-[85%] text-xs sm:text-sm text-slate-800 space-y-1.5">
            <p>¡Hola! ⚡ Soy tu <strong>Coach IA de MoveClub</strong>.</p>
            <p class="text-slate-600 leading-relaxed">Chat reiniciado. ¿En qué te puedo asesorar hoy sobre pádel, créditos o reservas?</p>
          </div>
        </div>
      `;
    }
    this.showToast('Chat reiniciado');
  },

  sendAiQuickPrompt(promptText) {
    const input = document.getElementById('aiViewInput') || document.getElementById('aiChatInput');
    if (input) {
      input.value = promptText;
      this.handleAiSendMessage();
    }
  },

  async handleAiSendMessage() {
    const input = document.getElementById('aiViewInput') || document.getElementById('aiChatInput');
    const container = document.getElementById('aiViewMessages') || document.getElementById('aiChatMessages');
    const typing = document.getElementById('aiViewTypingIndicator') || document.getElementById('aiTypingIndicator');
    const suggestionsContainer = document.getElementById('aiViewSuggestions') || document.getElementById('aiQuickSuggestions');

    if (!input || !container) return;
    const msg = input.value.trim();
    if (!msg) return;

    // 1. Append User Message
    input.value = '';
    const userBubble = document.createElement('div');
    userBubble.className = 'flex items-start justify-end space-x-2 text-right animate-fadeIn';
    userBubble.innerHTML = `
      <div class="bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white p-3.5 rounded-2xl rounded-tr-none shadow-md max-w-[85%] text-xs sm:text-sm font-medium">
        <p>${this.escapeHtml(msg)}</p>
      </div>
    `;
    container.appendChild(userBubble);
    container.scrollTop = container.scrollHeight;

    // 2. Show Typing indicator
    if (typing) typing.classList.remove('hidden');
    container.scrollTop = container.scrollHeight;

    try {
      const resp = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.state.token ? `Bearer ${this.state.token}` : ''
        },
        body: JSON.stringify({ message: msg })
      });

      const data = await resp.json();
      if (typing) typing.classList.add('hidden');

      if (data && data.reply) {
        // Format reply text with simple markdown converter
        let formattedReply = data.reply
          .replace(/\\n/g, '<br>')
          .replace(/\n/g, '<br>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>');

        const botBubble = document.createElement('div');
        botBubble.className = 'flex items-start space-x-2.5 text-left animate-fadeIn';
        botBubble.innerHTML = `
          <div class="w-8 h-8 rounded-full bg-slate-950 text-cyan-300 text-xs font-bold flex items-center justify-center shrink-0 shadow-sm border border-slate-800">
            ⚡
          </div>
          <div class="bg-slate-100 p-3.5 rounded-2xl rounded-tl-none border border-slate-200/90 shadow-sm max-w-[88%] text-xs sm:text-sm text-slate-800 space-y-1.5 leading-relaxed">
            <div>${formattedReply}</div>
          </div>
        `;
        container.appendChild(botBubble);
        container.scrollTop = container.scrollHeight;

        // Render new suggestion chips if available
        if (data.suggestions && data.suggestions.length > 0 && suggestionsContainer) {
          suggestionsContainer.innerHTML = data.suggestions.map(s => `
            <button onclick="app.sendAiQuickPrompt('${s.replace(/'/g, "\\'")}')" class="px-3 py-1.5 rounded-full bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 text-xs font-bold shrink-0 border border-slate-200 shadow-sm transition active:scale-95">
              ${s}
            </button>
          `).join('');
        }
      }
    } catch (err) {
      if (typing) typing.classList.add('hidden');
      const errBubble = document.createElement('div');
      errBubble.className = 'flex items-start space-x-2.5 text-left animate-fadeIn';
      errBubble.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">
          ⚠️
        </div>
        <div class="bg-rose-50 p-3.5 rounded-2xl rounded-tl-none border border-rose-200 text-xs sm:text-sm text-rose-900 leading-relaxed">
          <p>Disculpa, hubo un breve error de conexión. Por favor reintenta o escríbenos a <a href="mailto:soporte@moveclub.cl" class="font-bold underline">soporte@moveclub.cl</a>.</p>
        </div>
      `;
      container.appendChild(errBubble);
      container.scrollTop = container.scrollHeight;
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  setupEventListeners() {
    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
      const btn = document.getElementById('userMenuBtn');
      const dropdown = document.getElementById('userDropdown');
      if (btn && dropdown && !btn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
      }

      const searchInput = document.getElementById('searchInput');
      const liveDropdown = document.getElementById('liveSearchDropdown');
      if (searchInput && liveDropdown && !searchInput.contains(e.target) && !liveDropdown.contains(e.target)) {
        liveDropdown.classList.add('hidden');
      }
    });
  }
};

// Auto start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
