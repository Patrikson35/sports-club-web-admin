// API Configuration
const stripWrappingQuotes = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';

  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  const isWrapped = (first === '"' && last === '"') || (first === "'" && last === "'");

  return isWrapped ? normalized.slice(1, -1).trim() : normalized;
};

const normalizeApiBaseUrl = (rawUrl) => {
  const fallback = 'https://ppsport-api-v2-production.up.railway.app/api';
  const value = stripWrappingQuotes(rawUrl);

  if (!value) {
    return fallback;
  }

  // Prefer unversioned /api because current backend exposes routes under /api/*.
  if (value.endsWith('/api/v1')) {
    return value.slice(0, -3);
  }

  if (value.endsWith('/api')) {
    return value;
  }

  return value;
};

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);

const toLegacyApiBase = (baseUrl) => {
  const value = stripWrappingQuotes(baseUrl);
  if (!value) return value;

  // Keep compatibility fallback in both directions when environments differ.
  if (value.endsWith('/api')) {
    return `${value}/v1`;
  }

  if (value.endsWith('/api/v1')) {
    return value.slice(0, -3);
  }
  return value;
};

// Mock režim je v admin UI vypnutý; klient používa iba reálne API.
const USE_MOCK_DATA = false;
const MOCK_METRICS_STORAGE_KEY = 'mockMetrics';
const MOCK_VISIBLE_SECTIONS_STORAGE_KEY = 'mockVisibleSectionsByRole';

const DEFAULT_MOCK_VISIBLE_SECTIONS_BY_ROLE = {
  club: ['categories', 'coaches', 'players', 'attendance', 'matches', 'trainings', 'exercises', 'tests', 'membershipFees', 'communication'],
  coach: ['categories', 'players', 'attendance', 'matches', 'trainings', 'exercises', 'tests', 'communication'],
  parent: ['attendance', 'matches', 'trainings', 'tests', 'membershipFees', 'communication'],
  player: ['attendance', 'matches', 'trainings', 'tests']
};

const normalizeVisibleRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'club_admin') return 'club';
  return normalized;
};

const readMockVisibleSectionsByRole = () => {
  try {
    const raw = localStorage.getItem(MOCK_VISIBLE_SECTIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_MOCK_VISIBLE_SECTIONS_BY_ROLE };
    }

    return {
      club: Array.isArray(parsed.club) ? parsed.club : [...DEFAULT_MOCK_VISIBLE_SECTIONS_BY_ROLE.club],
      coach: Array.isArray(parsed.coach) ? parsed.coach : [...DEFAULT_MOCK_VISIBLE_SECTIONS_BY_ROLE.coach],
      parent: Array.isArray(parsed.parent) ? parsed.parent : [...DEFAULT_MOCK_VISIBLE_SECTIONS_BY_ROLE.parent],
      player: Array.isArray(parsed.player) ? parsed.player : [...DEFAULT_MOCK_VISIBLE_SECTIONS_BY_ROLE.player]
    };
  } catch {
    return { ...DEFAULT_MOCK_VISIBLE_SECTIONS_BY_ROLE };
  }
};

const writeMockVisibleSectionsByRole = (roles) => {
  const payload = {
    club: Array.isArray(roles?.club) ? roles.club : [...DEFAULT_MOCK_VISIBLE_SECTIONS_BY_ROLE.club],
    coach: Array.isArray(roles?.coach) ? roles.coach : [...DEFAULT_MOCK_VISIBLE_SECTIONS_BY_ROLE.coach],
    parent: Array.isArray(roles?.parent) ? roles.parent : [...DEFAULT_MOCK_VISIBLE_SECTIONS_BY_ROLE.parent],
    player: Array.isArray(roles?.player) ? roles.player : [...DEFAULT_MOCK_VISIBLE_SECTIONS_BY_ROLE.player]
  };

  try {
    localStorage.setItem(MOCK_VISIBLE_SECTIONS_STORAGE_KEY, JSON.stringify(payload));
  } catch {}

  return payload;
};

const createDefaultMockMetrics = () => ([
  { id: 'default-trainings-count', name: 'Počet tréningov', shortName: '', type: 'number', valueTypes: ['number'], mode: 'manual', isDefault: true, isActive: true, formula: [] },
  { id: 'default-matches-count', name: 'Počet zápasov', shortName: '', type: 'number', valueTypes: ['number'], mode: 'manual', isDefault: true, isActive: true, formula: [] },
  {
    id: 'default-load-days',
    name: 'Dni záťaže',
    shortName: '',
    type: 'number',
    valueTypes: ['number'],
    mode: 'formula',
    isDefault: true,
    isActive: true,
    formula: [
      { type: 'variable', metricId: 'default-trainings-count' },
      { type: 'operator', op: '+' },
      { type: 'variable', metricId: 'default-matches-count' }
    ]
  },
  { id: 'default-calendar-days', name: 'Kalendárne dni', shortName: 'KD', type: 'number', valueTypes: ['number'], mode: 'manual', isDefault: true, isActive: true, formula: [] },
  { id: 'default-game-load', name: 'Herná záťaž (minúty)', shortName: '', type: 'minutes', valueTypes: ['minutes'], mode: 'manual', isDefault: true, isActive: true, formula: [] },
  { id: 'default-training-intensity', name: 'Intenzita tréningu', shortName: '', type: 'percent', valueTypes: ['percent'], mode: 'manual', isDefault: true, isActive: true, formula: [] },
  { id: 'default-attendance', name: 'Dochádzka %', shortName: '', type: 'percent', valueTypes: ['percent'], mode: 'manual', isDefault: true, isActive: true, formula: [] }
]);

let MOCK_METRICS = createDefaultMockMetrics();

const loadStoredMockMetrics = () => {
  try {
    const raw = localStorage.getItem(MOCK_METRICS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const persistMockMetrics = () => {
  try {
    localStorage.setItem(MOCK_METRICS_STORAGE_KEY, JSON.stringify(MOCK_METRICS));
  } catch {
    return;
  }
};

const storedMockMetrics = loadStoredMockMetrics();
if (Array.isArray(storedMockMetrics) && storedMockMetrics.length > 0) {
  MOCK_METRICS = storedMockMetrics;
} else {
  persistMockMetrics();
}

// API Client
class APIClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('authToken');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  handleAuthFailure(error) {
    const status = Number(error?.status || 0);
    const message = String(error?.payload?.error || error?.message || '').toLowerCase();
    const hasTokenFailureMessage = (
      message.includes('access token required')
      || message.includes('invalid or expired token')
      || message.includes('jwt expired')
      || message.includes('invalid token')
      || message.includes('token expired')
    );

    // 403 can be a normal RBAC deny; do not force logout unless token is actually invalid.
    const isAuthFailure = status === 401 || hasTokenFailureMessage;

    if (!isAuthFailure) return;

    this.clearToken();
    localStorage.removeItem('user');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth-expired'));
    }
  }

  async request(endpoint, options = {}) {
    const buildUrl = (base) => `${base}${endpoint}`;
    const isFormData = options.body instanceof FormData;
    const persistedToken = localStorage.getItem('authToken');
    if (!this.token && persistedToken) {
      this.token = persistedToken;
    }
    const headers = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const executeRequest = async (baseUrl) => {
      const response = await fetch(buildUrl(baseUrl), {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorBody = null;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = null;
        }

        const apiError = new Error(errorBody?.error || `API request failed (${response.status})`);
        apiError.status = response.status;
        apiError.payload = errorBody;
        throw apiError;
      }

      if (response.status === 204) {
        return {};
      }

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      const rawBody = await response.text();
      if (!rawBody.trim()) {
        return {};
      }

      if (contentType.includes('application/json')) {
        try {
          return JSON.parse(rawBody);
        } catch {
          return {};
        }
      }

      return { raw: rawBody };
    };

    try {
      return await executeRequest(this.baseURL);
    } catch (error) {
      const fallbackBase = toLegacyApiBase(this.baseURL);
      const shouldFallback =
        Number(error?.status || 0) === 404 &&
        fallbackBase &&
        fallbackBase !== this.baseURL;

      if (shouldFallback) {
        try {
          return await executeRequest(fallbackBase);
        } catch (fallbackError) {
          this.handleAuthFailure(fallbackError);
          console.error('API Error:', fallbackError);
          throw fallbackError;
        }
      }

      this.handleAuthFailure(error);
      console.error('API Error:', error);
      throw error;
    }
  }

  isEndpointNotFound(error) {
    const status = Number(error?.status || 0);
    if (status === 404) return true;

    const payloadMessage = String(error?.payload?.message || '').toLowerCase();
    const payloadError = String(error?.payload?.error || '').toLowerCase();
    const directMessage = String(error?.message || '').toLowerCase();
    const merged = `${payloadMessage} ${payloadError} ${directMessage}`;
    return (
      merged.includes('endpoint not found')
      || merged.includes('route ') && merged.includes(' not found')
      || payloadError === 'not_found'
      || payloadError === 'endpoint_not_found'
    );
  }

  isRetryableTrainingSchemaError(error) {
    const payloadMessage = String(error?.payload?.message || '').toLowerCase();
    const payloadError = String(error?.payload?.error || '').toLowerCase();
    const directMessage = String(error?.message || '').toLowerCase();
    const merged = `${payloadMessage} ${payloadError} ${directMessage}`;

    return (
      merged.includes("unknown column 'date'")
      || merged.includes('unknown column `date`')
      || merged.includes("unknown column 'start_time'")
      || merged.includes('unknown column `start_time`')
      || merged.includes("unknown column 'end_time'")
      || merged.includes('unknown column `end_time`')
      || merged.includes("unknown column 'scheduled_date'")
      || merged.includes('unknown column `scheduled_date`')
    );
  }

  isRetryableTrainingCreatePayloadError(error) {
    const payloadMessage = String(error?.payload?.message || '').toLowerCase();
    const payloadError = String(error?.payload?.error || '').toLowerCase();
    const directMessage = String(error?.message || '').toLowerCase();
    const merged = `${payloadMessage} ${payloadError} ${directMessage}`;

    return (
      merged.includes('missing required fields')
      || merged.includes('required fields')
      || merged.includes('missing required time range')
      || merged.includes('validation failed')
      || merged.includes('validacia zlyhala')
    );
  }

  async requestWithEndpointFallback(endpoints, options = {}) {
    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        return await this.request(endpoint, options);
      } catch (error) {
        lastError = error;
        if (!this.isEndpointNotFound(error) && !this.isRetryableTrainingSchemaError(error)) {
          throw error;
        }
      }
    }

    throw lastError || new Error('Endpoint not found');
  }

  // Auth
  async login(email, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    return {
      token: response?.access_token || response?.token || '',
      refreshToken: response?.refresh_token || response?.refreshToken || '',
      user: response?.user || null,
    };
  }

  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getRegistrationContext() {
    if (USE_MOCK_DATA) {
      return {
        role: 'player',
        isParentFlow: false
      };
    }

    return this.request('/auth/registration-context');
  }

  async getRegistrationSports() {
    if (USE_MOCK_DATA) {
      return {
        total: 6,
        sports: [
          { key: 'football', label: 'Futbal', sortOrder: 1, isActive: true },
          { key: 'hockey', label: 'Hokej', sortOrder: 2, isActive: true },
          { key: 'basketball', label: 'Basketbal', sortOrder: 3, isActive: true },
          { key: 'handball', label: 'Hadzana', sortOrder: 4, isActive: true },
          { key: 'volleyball', label: 'Volejbal', sortOrder: 5, isActive: true },
          { key: 'tennis', label: 'Tenis', sortOrder: 6, isActive: true }
        ]
      };
    }

    return this.request('/auth/registration-sports');
  }

  async getWebSettingsSports() {
    if (USE_MOCK_DATA) {
      return this.getRegistrationSports();
    }

    return this.request('/auth/web-settings/sports');
  }

  async updateWebSettingsSports(sports) {
    if (USE_MOCK_DATA) {
      return {
        message: 'Web settings sports updated (mock)',
        total: Array.isArray(sports) ? sports.length : 0,
        sports: Array.isArray(sports) ? sports : []
      };
    }

    return this.request('/auth/web-settings/sports', {
      method: 'PUT',
      body: JSON.stringify({
        sports: Array.isArray(sports) ? sports : []
      }),
    });
  }

  // Registration endpoints (new system)
  async registerClub(data) {
    if (USE_MOCK_DATA) {
      return { message: 'Club registration successful (mock)', userId: Date.now(), clubId: Date.now() };
    }
    return this.request('/registration/register-club', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async registerCoach(data) {
    if (USE_MOCK_DATA) {
      return { message: 'Coach registration successful (mock)', userId: Date.now() };
    }
    return this.request('/registration/register-coach', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async registerPrivateCoach(data) {
    if (USE_MOCK_DATA) {
      return { message: 'Private coach registration successful (mock)', userId: Date.now() };
    }
    return this.request('/registration/register-private-coach', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async registerAssistant(data) {
    if (USE_MOCK_DATA) {
      return { message: 'Assistant registration successful (mock)', userId: Date.now() };
    }
    return this.request('/registration/register-assistant', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async registerPlayer(data) {
    if (USE_MOCK_DATA) {
      return { message: 'Player registration successful (mock)', userId: Date.now() };
    }
    return this.request('/registration/register-player', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async registerParent(data) {
    if (USE_MOCK_DATA) {
      return { message: 'Parent registration successful (mock)', userId: Date.now() };
    }
    return this.request('/registration/register-parent', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Invites
  async getInviteDetails(inviteCode) {
    if (USE_MOCK_DATA) {
      return { 
        invite: {
          inviteType: 'coach',
          email: 'test@example.com',
          clubName: 'FC Test',
          inviterName: 'Admin Test'
        }
      };
    }
    return this.request(`/invites/${inviteCode}`);
  }

  async sendInvite(data) {
    if (USE_MOCK_DATA) {
      return { message: 'Invite sent (mock)', inviteCode: 'MOCK_' + Date.now() };
    }
    return this.request('/invites/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Verification
  async verifyEmail(token) {
    return this.requestWithEndpointFallback([
      '/auth/verify-email',
      '/verification/verify-email',
    ], {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async uploadImage(file, folder = 'misc') {
    if (USE_MOCK_DATA) {
      return {
        message: 'Image uploaded (mock)',
        fileUrl: `https://example.com/uploads/${folder}/${Date.now()}-${file?.name || 'image.png'}`,
        relativePath: `/uploads/${folder}/${Date.now()}-${file?.name || 'image.png'}`
      };
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    return this.request('/uploads/image', {
      method: 'POST',
      body: formData,
    });
  }

  async uploadClubLogo(file) {
    return this.uploadImage(file, 'club-logos');
  }

  async uploadCoachPhoto(file) {
    return this.uploadImage(file, 'coach-photos');
  }

  async completeCoachProfile(data) {
    if (USE_MOCK_DATA) {
      return { message: 'Coach profile saved (mock)' };
    }

    return this.request('/coaches/my-profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getCoachProfile() {
    if (USE_MOCK_DATA) {
      return {
        isClubCoach: false,
        isPersonalCoach: false,
        clubName: '',
        country: 'SK',
        photo: ''
      };
    }

    return this.request('/coaches/my-profile');
  }

  async verifyParentConsent(token, consentGiven) {
    if (USE_MOCK_DATA) {
      return { message: 'Consent verified (mock)' };
    }
    return this.requestWithEndpointFallback([
      '/auth/verify-parent-consent',
      '/verification/verify-parent-consent',
    ], {
      method: 'POST',
      body: JSON.stringify({ token, consentGiven }),
    });
  }

  async resendVerification(email) {
    return this.requestWithEndpointFallback([
      '/auth/resend-verification',
      '/verification/resend-verification',
    ], {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async getPendingRegistrations() {
    if (USE_MOCK_DATA) {
      return { total: 0, users: [] };
    }
    return this.requestWithEndpointFallback([
      '/auth/pending',
      '/registration/pending',
    ]);
  }

  async approveRegistration(userId) {
    if (USE_MOCK_DATA) {
      return { message: 'Approved (mock)' };
    }
    return this.requestWithEndpointFallback([
      `/auth/approve/${userId}`,
      `/registration/approve/${userId}`,
    ], {
      method: 'POST',
    });
  }

  async rejectRegistration(userId) {
    if (USE_MOCK_DATA) {
      return { message: 'Rejected (mock)' };
    }
    return this.requestWithEndpointFallback([
      `/auth/reject/${userId}`,
      `/registration/reject/${userId}`,
    ], {
      method: 'POST',
    });
  }

  // Players
  async getPlayers(params = {}) {
    if (USE_MOCK_DATA) {
      return {
        total: 10,
        players: [
          { id: 1, firstName: 'Lucas', lastName: 'Pavlenda', jerseyNumber: 5, position: 'striker', team: { name: 'U9' } },
          { id: 2, firstName: 'L.', lastName: 'Pavlenová', jerseyNumber: 15, position: 'midfielder', team: { name: 'U9' } },
          { id: 3, firstName: 'P.', lastName: 'Bielik', jerseyNumber: 45, position: 'defender', team: { name: 'U9' } },
        ]
      };
    }
    const query = new URLSearchParams(params).toString();
    return this.request(`/players?${query}`);
  }

  async getPlayer(id) {
    if (USE_MOCK_DATA) {
      return { id, firstName: 'Lucas', lastName: 'Pavlenda', jerseyNumber: 5, position: 'striker' };
    }
    return this.request(`/players/${id}`);
  }

  async completePlayerProfile(data) {
    if (USE_MOCK_DATA) {
      return { message: 'Player profile saved (mock)' };
    }

    return this.request('/players/my-profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getMyPlayerProfile() {
    if (USE_MOCK_DATA) {
      return {
        clubName: '',
        personalId: '',
        photo: ''
      };
    }

    return this.request('/players/my-profile');
  }

  async completePlayerChildrenProfiles(children) {
    if (USE_MOCK_DATA) {
      return { message: 'Children profiles saved (mock)', childrenSaved: children?.length || 0 };
    }

    return this.request('/players/my-children-profiles', {
      method: 'PUT',
      body: JSON.stringify({ children }),
    });
  }

  async getMyPlayerChildrenProfiles() {
    if (USE_MOCK_DATA) {
      return { total: 0, children: [] };
    }

    return this.request('/players/my-children-profiles');
  }

  async unlinkPlayerChild(childUserId) {
    if (USE_MOCK_DATA) {
      return { message: 'Child unlinked (mock)', childUserId, isVirtual: true };
    }

    return this.request(`/players/unlink-child/${childUserId}`, {
      method: 'POST',
    });
  }

  async getPermissionCatalog() {
    if (USE_MOCK_DATA) {
      return { catalog: {}, allPermissions: [] };
    }

    return this.request('/club-permissions/catalog');
  }

  async getMyClubPermissions(clubId) {
    if (USE_MOCK_DATA) {
      return {
        clubId,
        user: { id: 0, role: 'club', customTitle: '' },
        delegatedPermissions: [],
        effectivePermissions: []
      };
    }

    return this.request(`/club-permissions/club/${clubId}/me`);
  }

  async getClubMembersPermissions(clubId) {
    if (USE_MOCK_DATA) {
      return { total: 0, members: [] };
    }

    return this.request(`/club-permissions/club/${clubId}/members`);
  }

  async updateClubMemberPermissions(clubId, userId, data) {
    if (USE_MOCK_DATA) {
      return {
        message: 'Delegated permissions saved (mock)',
        clubId,
        userId,
        customTitle: data?.customTitle || '',
        delegatedPermissions: data?.permissions || []
      };
    }

    return this.request(`/club-permissions/club/${clubId}/member/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getClubVisibleSections(clubId) {
    if (USE_MOCK_DATA) {
      const roles = readMockVisibleSectionsByRole();
      return {
        clubId,
        roles
      };
    }

    return this.request(`/club-permissions/club/${clubId}/visible-sections`);
  }

  async updateClubVisibleSections(clubId, data) {
    if (USE_MOCK_DATA) {
      const roles = writeMockVisibleSectionsByRole(data?.roles || {});
      return { message: 'Visible sections saved (mock)', clubId, roles };
    }

    return this.request(`/club-permissions/club/${clubId}/visible-sections`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getMyVisibleSections() {
    if (USE_MOCK_DATA) {
      const roles = readMockVisibleSectionsByRole();
      let role = 'club';
      try {
        const userRaw = localStorage.getItem('user');
        const user = userRaw ? JSON.parse(userRaw) : null;
        role = normalizeVisibleRole(user?.role || 'club') || 'club';
      } catch {
        role = 'club';
      }

      const sections = Array.isArray(roles?.[role])
        ? roles[role]
        : (DEFAULT_MOCK_VISIBLE_SECTIONS_BY_ROLE[role] || DEFAULT_MOCK_VISIBLE_SECTIONS_BY_ROLE.club);

      return { role, sections, source: 'mock-storage' };
    }

    return this.request('/club-permissions/me/visible-sections');
  }

  async getClubManagerRoles(clubId) {
    if (USE_MOCK_DATA) {
      return { total: 0, roles: [] };
    }

    return this.request(`/club-permissions/club/${clubId}/manager-roles`);
  }

  async createClubManagerRole(clubId, data) {
    if (USE_MOCK_DATA) {
      return { message: 'Manager role saved (mock)', roleId: Date.now() };
    }

    return this.request(`/club-permissions/club/${clubId}/manager-roles`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateClubManagerRole(clubId, roleId, data) {
    if (USE_MOCK_DATA) {
      return { message: 'Manager role updated (mock)', roleId };
    }

    return this.request(`/club-permissions/club/${clubId}/manager-roles/${roleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteClubManagerRole(clubId, roleId) {
    if (USE_MOCK_DATA) {
      return { message: 'Manager role deleted (mock)', roleId };
    }

    return this.request(`/club-permissions/club/${clubId}/manager-roles/${roleId}`, {
      method: 'DELETE',
    });
  }

  async getClubManagers(clubId) {
    if (USE_MOCK_DATA) {
      return { total: 0, managers: [] };
    }

    return this.request(`/club-permissions/club/${clubId}/managers`);
  }

  async createClubManager(clubId, data) {
    if (USE_MOCK_DATA) {
      return { message: 'Manager created (mock)', managerId: Date.now() };
    }

    return this.request(`/club-permissions/club/${clubId}/managers`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateClubManager(clubId, managerId, data) {
    if (USE_MOCK_DATA) {
      return { message: 'Manager updated (mock)', managerId };
    }

    return this.request(`/club-permissions/club/${clubId}/managers/${managerId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteClubManager(clubId, managerId) {
    if (USE_MOCK_DATA) {
      return { message: 'Manager deleted (mock)' };
    }

    return this.request(`/club-permissions/club/${clubId}/managers/${managerId}`, {
      method: 'DELETE',
    });
  }

  async getClubTrainerFunctions(clubId) {
    if (USE_MOCK_DATA) {
      return {
        total: 5,
        functions: [
          { id: 1, name: 'Hlavný tréner', baseRole: 'coach', isDefault: true },
          { id: 2, name: 'Asistent trénera', baseRole: 'assistant', isDefault: true },
          { id: 3, name: 'Kondičný tréner', baseRole: 'assistant', isDefault: true },
          { id: 4, name: 'Tréner brankárov', baseRole: 'assistant', isDefault: true },
          { id: 5, name: 'Mentálny tréner', baseRole: 'assistant', isDefault: true }
        ]
      };
    }

    return this.request(`/club-permissions/club/${clubId}/trainer-functions`);
  }

  async createClubTrainerFunction(clubId, data) {
    if (USE_MOCK_DATA) {
      const functionName = String(data?.name || '').trim();
      const baseRole = functionName.toLowerCase() === 'hlavný tréner' ? 'coach' : 'assistant';
      return {
        message: 'Trainer function saved (mock)',
        function: { id: Date.now(), name: functionName, baseRole, isDefault: false }
      };
    }

    return this.request(`/club-permissions/club/${clubId}/trainer-functions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateClubTrainerFunction(clubId, functionId, data) {
    if (USE_MOCK_DATA) {
      const functionName = String(data?.name || '').trim();
      const baseRole = functionName.toLowerCase() === 'hlavný tréner' ? 'coach' : 'assistant';
      return {
        message: 'Trainer function updated (mock)',
        function: { id: functionId, name: functionName, baseRole, isDefault: false }
      };
    }

    return this.request(`/club-permissions/club/${clubId}/trainer-functions/${functionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteClubTrainerFunction(clubId, functionId) {
    if (USE_MOCK_DATA) {
      return { message: 'Trainer function deleted (mock)', functionId };
    }

    return this.request(`/club-permissions/club/${clubId}/trainer-functions/${functionId}`, {
      method: 'DELETE',
    });
  }

  async getMetrics(params = {}) {
    if (USE_MOCK_DATA) {
      return {
        total: MOCK_METRICS.length,
        metrics: MOCK_METRICS.map((metric) => ({
          ...metric,
          formula: Array.isArray(metric.formula) ? JSON.parse(JSON.stringify(metric.formula)) : []
        }))
      };
    }

    const query = new URLSearchParams(params).toString();
    return this.request(`/metrics${query ? `?${query}` : ''}`);
  }

  async createMetric(data) {
    if (USE_MOCK_DATA) {
      const valueTypes = Array.isArray(data?.valueTypes) ? data.valueTypes.filter(Boolean) : [];
      const primaryType = valueTypes[0] || data?.type || 'number';
      const created = {
        id: `custom-${Date.now()}`,
        name: String(data?.name || '').trim(),
        shortName: String(data?.shortName || '').trim(),
        type: primaryType,
        valueTypes: valueTypes.length > 0 ? valueTypes : [primaryType],
        mode: data?.mode || 'manual',
        isDefault: data?.isDefault === true,
        isActive: data?.isActive !== false,
        formula: Array.isArray(data?.formula) ? JSON.parse(JSON.stringify(data.formula)) : []
      };

      MOCK_METRICS = [...MOCK_METRICS, created];
      persistMockMetrics();
      return { message: 'Metric created (mock)', metric: created };
    }

    return this.request('/metrics', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMetric(metricId, data) {
    if (USE_MOCK_DATA) {
      const valueTypes = Array.isArray(data?.valueTypes) ? data.valueTypes.filter(Boolean) : null;
      MOCK_METRICS = MOCK_METRICS.map((metric) => (
        String(metric.id) === String(metricId)
          ? {
              ...metric,
              ...data,
              shortName: data?.shortName === undefined ? metric.shortName : String(data?.shortName || '').trim(),
              type: valueTypes && valueTypes.length > 0 ? valueTypes[0] : (data?.type || metric.type),
              valueTypes: valueTypes && valueTypes.length > 0
                ? valueTypes
                : (Array.isArray(metric.valueTypes) && metric.valueTypes.length > 0 ? metric.valueTypes : [metric.type || 'number']),
              formula: Array.isArray(data?.formula) ? JSON.parse(JSON.stringify(data.formula)) : (metric.formula || [])
            }
          : metric
      ));

      const updated = MOCK_METRICS.find((metric) => String(metric.id) === String(metricId));
      persistMockMetrics();
      return { message: 'Metric updated (mock)', metric: updated };
    }

    return this.request(`/metrics/${metricId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async reorderMetrics(metricIds = []) {
    if (USE_MOCK_DATA) {
      const order = Array.isArray(metricIds) ? metricIds.map((id) => String(id || '').trim()).filter(Boolean) : [];
      if (order.length > 0) {
        const orderMap = new Map(order.map((id, index) => [id, index]));
        MOCK_METRICS = [...MOCK_METRICS].sort((a, b) => {
          const aIndex = orderMap.has(String(a?.id || '')) ? orderMap.get(String(a?.id || '')) : Number.MAX_SAFE_INTEGER;
          const bIndex = orderMap.has(String(b?.id || '')) ? orderMap.get(String(b?.id || '')) : Number.MAX_SAFE_INTEGER;
          return aIndex - bIndex;
        });
        persistMockMetrics();
      }
      return { message: 'Metrics reordered (mock)' };
    }

    return this.request('/metrics/reorder', {
      method: 'PUT',
      body: JSON.stringify({ metricIds: Array.isArray(metricIds) ? metricIds : [] }),
    });
  }

  async deleteMetric(metricId) {
    if (USE_MOCK_DATA) {
      const existing = MOCK_METRICS.find((metric) => String(metric.id) === String(metricId));
      if (existing?.isDefault) {
        return { message: 'Default metric cannot be deleted (mock)' };
      }

      MOCK_METRICS = MOCK_METRICS.filter((metric) => String(metric.id) !== String(metricId));
      persistMockMetrics();
      return { message: 'Metric deleted (mock)' };
    }

    return this.request(`/metrics/${metricId}`, {
      method: 'DELETE',
    });
  }

  async validateMetricFormula(data) {
    if (USE_MOCK_DATA) {
      const formula = Array.isArray(data?.formula) ? data.formula : [];
      const hasVariable = formula.some((node) => node?.type === 'variable' || (node?.type === 'function' && Array.isArray(node.args) && node.args.some((arg) => arg?.type === 'variable')));
      return {
        valid: hasVariable,
        errors: hasVariable ? [] : [{ code: 'MISSING_VARIABLE', message: 'Vzorec musí obsahovať aspoň jednu premennú.' }]
      };
    }

    return this.request('/metrics/validate-formula', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Teams
  async getTeams() {
    if (USE_MOCK_DATA) {
      return {
        total: 5,
        teams: [
          { id: 1, name: 'U7', ageGroup: 'U7', playerCount: 12, coachId: null },
          { id: 2, name: 'U9', ageGroup: 'U9', playerCount: 10, coachId: null },
          { id: 3, name: 'U11', ageGroup: 'U11', playerCount: 15, coachId: null },
        ]
      };
    }
    return this.request('/teams');
  }

  async createTeam(data) {
    if (USE_MOCK_DATA) {
      return { message: 'Category created (mock)', teamId: Date.now() };
    }

    return this.request('/teams', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTeam(teamId, data) {
    if (USE_MOCK_DATA) {
      return { message: 'Category updated (mock)', teamId };
    }

    return this.request(`/teams/${teamId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTeam(teamId) {
    if (USE_MOCK_DATA) {
      return { message: 'Category deleted (mock)', teamId };
    }

    return this.request(`/teams/${teamId}`, {
      method: 'DELETE',
    });
  }

  async reorderTeams(orderedTeamIds, clubId) {
    if (USE_MOCK_DATA) {
      return { message: 'Category order updated (mock)', orderedTeamIds };
    }

    return this.request('/teams/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedTeamIds, clubId }),
    });
  }

  async getTeamPlayers(teamId) {
    if (USE_MOCK_DATA) {
      return { total: 0, players: [] };
    }

    return this.request(`/teams/${teamId}/players`);
  }

  async getTeamCandidatePlayers(teamId) {
    if (USE_MOCK_DATA) {
      return { total: 0, candidates: [] };
    }

    return this.request(`/teams/${teamId}/candidates`);
  }

  async assignPlayerToTeam(teamId, data) {
    if (USE_MOCK_DATA) {
      return { message: 'Player assigned (mock)' };
    }

    return this.request(`/teams/${teamId}/players`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removePlayerFromTeam(teamId, userId) {
    if (USE_MOCK_DATA) {
      return { message: 'Player removed (mock)' };
    }

    return this.request(`/teams/${teamId}/players/${userId}`, {
      method: 'DELETE',
    });
  }

  async getMyClubMembers() {
    if (USE_MOCK_DATA) {
      return {
        clubId: 1,
        trainers: [],
        players: [],
        totals: { trainers: 0, players: 0 }
      };
    }

    return this.request('/clubs/my-club/members');
  }

  async updateMyClubTrainer(userId, data) {
    if (USE_MOCK_DATA) {
      return { message: 'Trainer updated (mock)', trainer: { userId, ...data } };
    }

    return this.request(`/clubs/my-club/trainers/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async createMyClubTrainer(data) {
    if (USE_MOCK_DATA) {
      return { message: 'Trainer created (mock)', trainer: { userId: Date.now(), ...data } };
    }

    return this.request('/clubs/my-club/trainers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteMyClubTrainer(userId) {
    if (USE_MOCK_DATA) {
      return { message: 'Trainer deleted (mock)' };
    }

    return this.request(`/clubs/my-club/trainers/${userId}`, {
      method: 'DELETE',
    });
  }

  async createMyClubPlayer(data) {
    if (USE_MOCK_DATA) {
      return { message: 'Player created (mock)', player: { userId: Date.now(), ...data } };
    }

    return this.request('/clubs/my-club/players', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMyClubPlayer(userId, data) {
    if (USE_MOCK_DATA) {
      return { message: 'Player updated (mock)', player: { userId, ...data } };
    }

    return this.request(`/clubs/my-club/players/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async removeMyClubPlayer(userId) {
    if (USE_MOCK_DATA) {
      return { message: 'Player removed from club (mock)' };
    }

    return this.request(`/clubs/my-club/players/${userId}`, {
      method: 'DELETE',
    });
  }

  // Trainings
  async getTrainings(params = {}) {
    if (USE_MOCK_DATA) {
      return {
        total: 6,
        trainings: [
          { id: 1, name: 'Tréning #52', date: '2024-05-02', location: 'Hlavní hřiště', status: 'completed', exerciseCount: 5 },
          { id: 2, name: 'Tréning #51', date: '2024-04-30', location: 'Hlavní hřiště', status: 'completed', exerciseCount: 4 },
        ]
      };
    }
    const query = new URLSearchParams(params).toString();
    return this.request(`/trainings?${query}`);
  }

  async createTraining(data) {
    if (USE_MOCK_DATA) {
      return { id: Date.now(), message: 'Training created (mock)' };
    }
    return this.request('/trainings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTeamTrainingSessions(teamId, params = {}) {
    if (USE_MOCK_DATA) {
      return { total: 0, sessions: [] };
    }

    const safeTeamId = String(teamId || '').trim();
    if (!safeTeamId) {
      throw new Error('teamId is required');
    }

    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : '';
    const scopedQuery = new URLSearchParams({ ...params, teamId: safeTeamId }).toString();
    const legacyQuery = new URLSearchParams({ ...params, team_id: safeTeamId }).toString();

    return this.requestWithEndpointFallback([
      // Prefer /trainings feed (DB source of truth) to avoid stale legacy variants.
      `/trainings?${scopedQuery}`,
      `/trainings?${legacyQuery}`,
      `/v1/trainings?${scopedQuery}`,
      `/v1/trainings?${legacyQuery}`,
      `/teams/${safeTeamId}/training-sessions${suffix}`,
      `/v1/teams/${safeTeamId}/training-sessions${suffix}`,
      `/${safeTeamId}/training-sessions${suffix}`,
      `/v1/${safeTeamId}/training-sessions${suffix}`,
      `/training-sessions?${scopedQuery}`,
      `/training-sessions?${legacyQuery}`,
      `/v1/training-sessions?${scopedQuery}`,
      `/v1/training-sessions?${legacyQuery}`,
    ]);
  }

  async createTeamTrainingSession(teamId, data) {
    if (USE_MOCK_DATA) {
      return { id: Date.now(), ...data };
    }

    const safeTeamId = String(teamId || '').trim();
    if (!safeTeamId) {
      throw new Error('teamId is required');
    }

    const payload = {
      ...data,
      team_id: safeTeamId,
      teamId: safeTeamId,
    };

    // Some backend variants reject unknown `name` column in SQL inserts.
    delete payload.name;

    const resolvedTitle = String(payload?.title || data?.name || '').trim();
    const resolvedDate = String(payload?.date || '').trim();
    const resolvedStartTime = String(payload?.start_time || payload?.startTime || '').trim();
    const resolvedEndTime = String(payload?.end_time || payload?.endTime || '').trim();

    const payloadForSessionEndpoints = { ...payload };
    const payloadForTrainingsBase = {
      ...payload,
      team_id: safeTeamId,
      title: resolvedTitle || payload?.title,
      date: resolvedDate || payload?.date,
      start_time: resolvedStartTime || payload?.start_time,
      end_time: resolvedEndTime || payload?.end_time,
    };
    const payloadForTrainingsCamelCase = {
      ...payload,
      teamId: safeTeamId,
      title: resolvedTitle || payload?.title,
      date: resolvedDate || payload?.date,
      startTime: resolvedStartTime || payload?.startTime,
      endTime: resolvedEndTime || payload?.endTime,
    };
    delete payloadForTrainingsCamelCase.team_id;
    delete payloadForTrainingsCamelCase.start_time;
    delete payloadForTrainingsCamelCase.end_time;

    const payloadForTrainingsNoDate = { ...payloadForTrainingsBase };
    delete payloadForTrainingsNoDate.date;
    delete payloadForTrainingsNoDate.training_date;
    delete payloadForTrainingsNoDate.scheduled_date;

    const payloadForTrainingsTrainingDate = {
      ...payloadForTrainingsNoDate,
      ...(resolvedDate ? { training_date: resolvedDate } : {}),
      ...(resolvedStartTime ? { start_time: resolvedStartTime } : {}),
      ...(resolvedEndTime ? { end_time: resolvedEndTime } : {}),
    };
    const payloadForTrainingsScheduledDate = {
      ...payloadForTrainingsNoDate,
      ...(resolvedDate ? { scheduled_date: resolvedDate } : {}),
      ...(resolvedStartTime ? { start_time: resolvedStartTime } : {}),
      ...(resolvedEndTime ? { end_time: resolvedEndTime } : {}),
    };

    const trainingsPayloadVariants = [
      payloadForTrainingsTrainingDate,
      payloadForTrainingsScheduledDate,
      payloadForTrainingsCamelCase,
      payloadForTrainingsBase,
    ];

    const attempts = [
      { endpoint: `/teams/${safeTeamId}/training-sessions`, body: payloadForSessionEndpoints },
      { endpoint: `/v1/teams/${safeTeamId}/training-sessions`, body: payloadForSessionEndpoints },
      { endpoint: `/${safeTeamId}/training-sessions`, body: payloadForSessionEndpoints },
      { endpoint: `/v1/${safeTeamId}/training-sessions`, body: payloadForSessionEndpoints },
      { endpoint: `/training-sessions`, body: payloadForSessionEndpoints },
      { endpoint: `/v1/training-sessions`, body: payloadForSessionEndpoints },
      ...trainingsPayloadVariants.flatMap((variant) => ([
        { endpoint: `/trainings`, body: variant },
        { endpoint: `/v1/trainings`, body: variant },
      ])),
    ];

    let lastError = null;
    const attemptDiagnostics = [];
    for (const attempt of attempts) {
      try {
        return await this.request(attempt.endpoint, {
          method: 'POST',
          body: JSON.stringify(attempt.body),
        });
      } catch (error) {
        lastError = error;
        const status = Number(error?.status || 0) || 'n/a';
        const message = String(error?.payload?.message || error?.payload?.error || error?.message || '').trim() || 'Unknown error';
        attemptDiagnostics.push(`${attempt.endpoint} -> ${status} (${message})`);
        if (!this.isEndpointNotFound(error) && !this.isRetryableTrainingSchemaError(error) && !this.isRetryableTrainingCreatePayloadError(error)) {
          throw error;
        }
      }
    }

    if (attemptDiagnostics.length > 0) {
      const diagnosticMessage = `Endpoint not found. Attempts: ${attemptDiagnostics.join(' | ')}`;
      const wrapped = new Error(diagnosticMessage);
      wrapped.cause = lastError || null;
      throw wrapped;
    }

    throw lastError || new Error('Endpoint not found');
  }

  async updateTeamTrainingSession(sessionId, teamId, data) {
    if (USE_MOCK_DATA) {
      return { id: sessionId, ...data };
    }

    const safeSessionId = String(sessionId || '').trim();
    if (!safeSessionId) {
      throw new Error('sessionId is required');
    }

    const safeTeamId = String(teamId || '').trim();
    const payload = {
      ...data,
      team_id: safeTeamId || data?.team_id,
      teamId: safeTeamId || data?.teamId,
    };

    delete payload.name;

    const trainingsUpdateBase = { ...payload };
    const trainingsUpdateNoDate = { ...trainingsUpdateBase };
    delete trainingsUpdateNoDate.date;
    delete trainingsUpdateNoDate.start_time;
    delete trainingsUpdateNoDate.end_time;
    delete trainingsUpdateNoDate.startTime;
    delete trainingsUpdateNoDate.endTime;

    const resolvedDate = String(data?.date || '').trim();
    const trainingsUpdateTrainingDate = {
      ...trainingsUpdateNoDate,
      ...(resolvedDate ? { training_date: resolvedDate } : {}),
    };
    const trainingsUpdateScheduledDate = {
      ...trainingsUpdateNoDate,
      ...(resolvedDate ? { scheduled_date: resolvedDate } : {}),
    };

    const trainingsUpdateVariants = [
      trainingsUpdateNoDate,
      trainingsUpdateTrainingDate,
      trainingsUpdateScheduledDate,
      trainingsUpdateBase,
    ];

    const attempts = [
      ...trainingsUpdateVariants.flatMap((variant) => ([
        { endpoint: `/trainings/${safeSessionId}`, method: 'PUT', body: variant },
        { endpoint: `/trainings/${safeSessionId}`, method: 'PATCH', body: variant },
        { endpoint: `/v1/trainings/${safeSessionId}`, method: 'PUT', body: variant },
        { endpoint: `/v1/trainings/${safeSessionId}`, method: 'PATCH', body: variant },
      ])),
      ...(safeTeamId ? [{ endpoint: `/teams/${safeTeamId}/training-sessions/${safeSessionId}`, method: 'PATCH' }] : []),
      ...(safeTeamId ? [{ endpoint: `/v1/teams/${safeTeamId}/training-sessions/${safeSessionId}`, method: 'PATCH' }] : []),
      ...(safeTeamId ? [{ endpoint: `/${safeTeamId}/training-sessions/${safeSessionId}`, method: 'PATCH' }] : []),
      ...(safeTeamId ? [{ endpoint: `/v1/${safeTeamId}/training-sessions/${safeSessionId}`, method: 'PATCH' }] : []),
      { endpoint: `/training-sessions/${safeSessionId}`, method: 'PATCH' },
      { endpoint: `/v1/training-sessions/${safeSessionId}`, method: 'PATCH' },
    ];

    let lastError = null;
    for (const attempt of attempts) {
      try {
        return await this.request(attempt.endpoint, {
          method: attempt.method,
          body: JSON.stringify(attempt.body || payload),
        });
      } catch (error) {
        lastError = error;
        if (!this.isEndpointNotFound(error)) {
          throw error;
        }
      }
    }

    throw lastError || new Error('Endpoint not found');
  }

  async deleteTeamTrainingSession(sessionId, teamId) {
    if (USE_MOCK_DATA) {
      return { id: sessionId, message: 'Deleted (mock)' };
    }

    const safeSessionId = String(sessionId || '').trim();
    if (!safeSessionId) {
      throw new Error('sessionId is required');
    }

    const safeTeamId = String(teamId || '').trim();

    const attempts = [
      { endpoint: `/trainings/${safeSessionId}` },
      { endpoint: `/v1/trainings/${safeSessionId}` },
      ...(safeTeamId ? [{ endpoint: `/teams/${safeTeamId}/training-sessions/${safeSessionId}` }] : []),
      ...(safeTeamId ? [{ endpoint: `/v1/teams/${safeTeamId}/training-sessions/${safeSessionId}` }] : []),
      ...(safeTeamId ? [{ endpoint: `/${safeTeamId}/training-sessions/${safeSessionId}` }] : []),
      ...(safeTeamId ? [{ endpoint: `/v1/${safeTeamId}/training-sessions/${safeSessionId}` }] : []),
      { endpoint: `/training-sessions/${safeSessionId}` },
      { endpoint: `/v1/training-sessions/${safeSessionId}` },
    ];

    let lastError = null;
    for (const attempt of attempts) {
      try {
        return await this.request(attempt.endpoint, {
          method: 'DELETE',
        });
      } catch (error) {
        lastError = error;
        if (!this.isEndpointNotFound(error)) {
          throw error;
        }
      }
    }

    throw lastError || new Error('Endpoint not found');
  }

  // Matches
  async getMatches(params = {}) {
    if (USE_MOCK_DATA) {
      return {
        total: 5,
        matches: [
          { id: 1, opponent: 'Banská Bystrica', matchDate: '2024-05-04', result: '2:1', status: 'completed' },
          { id: 2, opponent: 'Žilina', matchDate: '2024-05-11', result: '2:2', status: 'completed' },
        ]
      };
    }
    const query = new URLSearchParams(params).toString();
    return this.request(`/matches?${query}`);
  }

  async createMatch(data) {
    if (USE_MOCK_DATA) {
      return {
        message: 'Match created (mock)',
        match: {
          id: Date.now(),
          opponent: String(data?.opponent || '').trim(),
          matchDate: data?.matchDate || null,
          location: data?.location || null,
          matchType: data?.matchType || null,
          status: data?.status || 'scheduled',
          team: {
            id: Number(data?.teamId || 0),
            name: data?.teamName || 'Kategória',
            ageGroup: data?.categoryKey || 'default',
          },
        },
      };
    }

    const payload = data && typeof data === 'object' ? data : {};
    const safeTeamId = Number(payload?.teamId || payload?.team_id || 0);
    const safeOpponent = String(payload?.opponent || payload?.opponentTeam || payload?.opponent_team || '').trim();
    const safeMatchDate = String(payload?.matchDate || payload?.match_date || payload?.date || '').trim();

    const basePayload = {
      ...payload,
      teamId: safeTeamId || payload?.teamId,
      opponent: safeOpponent || payload?.opponent,
      matchDate: safeMatchDate || payload?.matchDate,
    };

    const snakeCasePayload = {
      ...basePayload,
      team_id: safeTeamId || basePayload?.team_id,
      opponent_team: safeOpponent || basePayload?.opponent_team,
      match_date: safeMatchDate || basePayload?.match_date,
    };

    const legacyNamedPayload = {
      ...basePayload,
      opponentTeam: safeOpponent || basePayload?.opponentTeam,
      date: safeMatchDate || basePayload?.date,
    };

    const minimalCamelPayload = {
      teamId: safeTeamId || basePayload?.teamId,
      opponent: safeOpponent || basePayload?.opponent,
      matchDate: safeMatchDate || basePayload?.matchDate,
    };

    const minimalSnakePayload = {
      team_id: safeTeamId || snakeCasePayload?.team_id,
      opponent_team: safeOpponent || snakeCasePayload?.opponent_team,
      match_date: safeMatchDate || snakeCasePayload?.match_date,
    };

    const payloadVariants = [
      basePayload,
      legacyNamedPayload,
      snakeCasePayload,
      minimalCamelPayload,
      minimalSnakePayload,
    ];

    const endpointAttempts = [
      '/matches',
      '/v1/matches',
      ...(safeTeamId > 0 ? [`/teams/${safeTeamId}/matches`, `/v1/teams/${safeTeamId}/matches`] : []),
    ];

    let lastError = null;
    const attemptDiagnostics = [];

    for (const endpoint of endpointAttempts) {
      for (const variant of payloadVariants) {
        try {
          const response = await this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(variant || {}),
          });

          const responseMatch = response?.match;
          if (responseMatch && typeof responseMatch === 'object') {
            return response;
          }

          const fallbackId = Number(response?.id || response?.matchId || response?.data?.id || 0);
          if (fallbackId > 0) {
            return {
              ...response,
              match: {
                id: fallbackId,
                opponent: safeOpponent || null,
                matchDate: safeMatchDate || null,
                location: payload?.location || null,
                matchType: payload?.matchType || null,
                status: payload?.status || 'scheduled',
                team: {
                  id: safeTeamId || null,
                  name: payload?.teamName || 'Kategória',
                  ageGroup: payload?.categoryKey || 'default',
                },
              },
            };
          }

          return response;
        } catch (error) {
          lastError = error;
          const status = Number(error?.status || 0);
          const message = String(error?.payload?.message || error?.payload?.error || error?.message || '').trim() || 'Unknown error';
          attemptDiagnostics.push(`${endpoint} -> ${status || 'n/a'} (${message})`);

          const isAccessError = status === 401 || status === 403;
          if (isAccessError) {
            throw error;
          }

          const isRetryableStatus = status === 0 || status === 400 || status === 404 || status === 405 || status === 422 || status >= 500;
          const isLikelyEndpointIssue = this.isEndpointNotFound(error);
          if (!isRetryableStatus && !isLikelyEndpointIssue) {
            throw error;
          }
        }
      }
    }

    if (attemptDiagnostics.length > 0) {
      const diagnosticMessage = `Vytvorenie zápasu zlyhalo. Pokusy: ${attemptDiagnostics.join(' | ')}`;
      const wrapped = new Error(diagnosticMessage);
      wrapped.cause = lastError || null;
      throw wrapped;
    }

    throw lastError || new Error('Vytvorenie zápasu zlyhalo');
  }

  async updateMatch(matchId, data) {
    const safeMatchId = Number(matchId || 0);
    if (!Number.isInteger(safeMatchId) || safeMatchId <= 0) {
      throw new Error('Neplatné matchId');
    }

    const payload = data && typeof data === 'object' ? data : {};
    const safeTeamId = Number(payload?.teamId || payload?.team_id || 0);
    const safeOpponent = String(payload?.opponent || payload?.opponentTeam || payload?.opponent_team || '').trim();
    const safeMatchDate = String(payload?.matchDate || payload?.match_date || payload?.date || '').trim();

    const basePayload = {
      ...payload,
      teamId: safeTeamId || payload?.teamId,
      opponent: safeOpponent || payload?.opponent,
      matchDate: safeMatchDate || payload?.matchDate,
    };

    const snakeCasePayload = {
      ...basePayload,
      team_id: safeTeamId || basePayload?.team_id,
      opponent_team: safeOpponent || basePayload?.opponent_team,
      match_date: safeMatchDate || basePayload?.match_date,
      match_type: basePayload?.matchType || basePayload?.match_type || null,
    };

    const legacyNamedPayload = {
      ...basePayload,
      opponentTeam: safeOpponent || basePayload?.opponentTeam,
      date: safeMatchDate || basePayload?.date,
    };

    const minimalCamelPayload = {
      teamId: safeTeamId || basePayload?.teamId,
      opponent: safeOpponent || basePayload?.opponent,
      matchDate: safeMatchDate || basePayload?.matchDate,
      location: basePayload?.location || null,
      matchType: basePayload?.matchType || null,
      status: basePayload?.status || 'scheduled',
      notes: basePayload?.notes || null,
    };

    const payloadVariants = [
      basePayload,
      legacyNamedPayload,
      snakeCasePayload,
      minimalCamelPayload,
    ];

    const endpointAttempts = [
      `/matches/${safeMatchId}`,
      `/v1/matches/${safeMatchId}`,
      ...(safeTeamId > 0 ? [`/teams/${safeTeamId}/matches/${safeMatchId}`, `/v1/teams/${safeTeamId}/matches/${safeMatchId}`] : []),
    ];

    let lastError = null;

    for (const endpoint of endpointAttempts) {
      for (const variant of payloadVariants) {
        try {
          return await this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(variant || {}),
          });
        } catch (error) {
          lastError = error;

          const status = Number(error?.status || 0);
          const isAccessError = status === 401 || status === 403;
          if (isAccessError) {
            throw error;
          }

          const isRetryableStatus = status === 0 || status === 400 || status === 404 || status === 405 || status === 422 || status >= 500;
          const isLikelyEndpointIssue = this.isEndpointNotFound(error);
          if (!isRetryableStatus && !isLikelyEndpointIssue) {
            throw error;
          }
        }
      }
    }

    throw lastError || new Error('Úprava zápasu zlyhala');
  }

  async deleteMatch(matchId) {
    return this.request(`/matches/${matchId}`, {
      method: 'DELETE',
    });
  }

  async getMatchCategoryIndicators(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/matches/settings/category-indicators${query ? `?${query}` : ''}`);
  }

  async updateMatchCategoryIndicators(data) {
    return this.request('/matches/settings/category-indicators', {
      method: 'PUT',
      body: JSON.stringify(data || {}),
    });
  }

  async getMatchEvidence(matchId) {
    return this.request(`/matches/${matchId}/evidence`);
  }

  async getMatchLineup(matchId) {
    return this.request(`/matches/${matchId}/lineup`);
  }

  async updateMatchEvidence(matchId, data) {
    return this.request(`/matches/${matchId}/evidence`, {
      method: 'PUT',
      body: JSON.stringify(data || {}),
    });
  }

  // Tests
  async getTestResults(params = {}) {
    if (USE_MOCK_DATA) {
      return {
        total: 5,
        results: [
          { id: 1, player: { name: 'Lucas Pavlenda' }, test: { name: '10m' }, value: '2.5', unit: 's', testDate: '2024-05-01' },
        ]
      };
    }
    const query = new URLSearchParams(params).toString();
    return this.request(`/tests/results?${query}`);
  }

  // Clubs
  async getClubs() {
    if (USE_MOCK_DATA) {
      return {
        total: 0,
        clubs: []
      };
    }
    return this.request('/clubs');
  }

  async createClub(data) {
    if (USE_MOCK_DATA) {
      return { id: Date.now(), message: 'Club created (mock)', club: { ...data, id: Date.now() } };
    }
    return this.request('/clubs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMyClub() {
    if (USE_MOCK_DATA) {
      return {
        id: 1,
        name: 'Mock Club',
        sport: 'football',
        ownerFirstName: '',
        ownerLastName: '',
        ownerEmail: '',
        bankName: '',
        swiftCode: '',
        accountHolderName: '',
        iban: '',
        address: '',
        city: '',
        country: 'SK',
        email: '',
        phone: '',
        website: ''
      };
    }
    return this.request('/clubs/my-club');
  }

  async getMyClubFieldTypes() {
    if (USE_MOCK_DATA) {
      return {
        sport: 'football',
        types: [
          { key: 'natural_grass', label: 'Prírodná tráva' },
          { key: 'artificial_grass', label: 'Umelá tráva' },
          { key: 'multifunctional_field', label: 'Multifunkčné ihrisko' },
          { key: 'indoor_hall', label: 'Hala' }
        ]
      };
    }

    return this.request('/clubs/my-club/field-types');
  }

  async updateMyClub(data) {
    if (USE_MOCK_DATA) {
      return { message: 'Club updated (mock)' };
    }
    return this.request('/clubs/my-club', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Club Fields (Ihriská)
  async getClubFields() {
    if (USE_MOCK_DATA) {
      return { total: 0, fields: [] };
    }
    return this.request('/clubs/my-club/fields');
  }

  async createClubField(data) {
    if (USE_MOCK_DATA) {
      return { message: 'Field created (mock)', field: { id: Date.now(), ...data, createdAt: new Date().toISOString() } };
    }
    return this.request('/clubs/my-club/fields', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateClubField(fieldId, data) {
    if (USE_MOCK_DATA) {
      return { message: 'Field updated (mock)', field: { id: fieldId, ...data } };
    }
    return this.request(`/clubs/my-club/fields/${fieldId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteClubField(fieldId) {
    if (USE_MOCK_DATA) {
      return { message: 'Field deleted (mock)' };
    }
    return this.request(`/clubs/my-club/fields/${fieldId}`, {
      method: 'DELETE',
    });
  }

  // Attendance Seasons (Sezóny dochádzky)
  async getAttendanceSeasons() {
    if (USE_MOCK_DATA) {
      return { total: 0, seasons: [] };
    }
    return this.request('/clubs/my-club/attendance-seasons');
  }

  async createAttendanceSeason(data) {
    if (USE_MOCK_DATA) {
      return { message: 'Season created (mock)', season: { id: Date.now(), ...data, createdAt: new Date().toISOString() } };
    }
    return this.request('/clubs/my-club/attendance-seasons', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAttendanceSeason(seasonId, data) {
    if (USE_MOCK_DATA) {
      return { message: 'Season updated (mock)', season: { id: seasonId, ...data } };
    }
    return this.request(`/clubs/my-club/attendance-seasons/${seasonId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAttendanceSeason(seasonId) {
    if (USE_MOCK_DATA) {
      return { message: 'Season deleted (mock)' };
    }
    return this.request(`/clubs/my-club/attendance-seasons/${seasonId}`, {
      method: 'DELETE',
    });
  }

  async getPlayerSeasonSummaries(season) {
    if (USE_MOCK_DATA) {
      return { total: 0, summaries: [] };
    }

    const normalizedSeason = String(season || '').trim();
    const query = normalizedSeason
      ? `?season=${encodeURIComponent(normalizedSeason)}`
      : '';

    return this.request(`/clubs/my-club/player-season-summaries${query}`);
  }

  async getPlayerTimelineSummaries(season, timelineType, timelineKey) {
    if (USE_MOCK_DATA) {
      return { total: 0, summaries: [] };
    }

    const params = new URLSearchParams();
    const normalizedSeason = String(season || '').trim();
    const normalizedTimelineType = String(timelineType || '').trim();
    const normalizedTimelineKey = String(timelineKey || '').trim();

    if (normalizedSeason) params.set('season', normalizedSeason);
    if (normalizedTimelineType) params.set('timelineType', normalizedTimelineType);
    if (normalizedTimelineKey) params.set('timelineKey', normalizedTimelineKey);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/clubs/my-club/player-timeline-summaries${query}`);
  }

  async getAttendanceDisplaySettings() {
    if (USE_MOCK_DATA) {
      return { settings: {} };
    }

    const isNonEmptyObject = (value) => (
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && Object.keys(value).length > 0
    );

    const extractSettings = (value) => (
      value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {}
    );

    const getSettingsTimestamp = (value) => {
      const raw = String(value?._savedAt || '').trim();
      if (!raw) return 0;
      const parsed = Date.parse(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const pickNewestSettings = (endpointSettings, fallbackSettings) => {
      const endpointCandidate = extractSettings(endpointSettings);
      const fallbackCandidate = extractSettings(fallbackSettings);
      const endpointHasData = isNonEmptyObject(endpointCandidate);
      const fallbackHasData = isNonEmptyObject(fallbackCandidate);

      if (endpointHasData && !fallbackHasData) return endpointCandidate;
      if (!endpointHasData && fallbackHasData) return fallbackCandidate;
      if (!endpointHasData && !fallbackHasData) return {};

      const endpointTs = getSettingsTimestamp(endpointCandidate);
      const fallbackTs = getSettingsTimestamp(fallbackCandidate);

      if (fallbackTs > endpointTs) return fallbackCandidate;
      return endpointCandidate;
    };

    const readFromMyClubFallback = async () => {
      const club = await this.getMyClub();
      const clubLevelSettings = (club?.attendanceDisplaySettings && typeof club.attendanceDisplaySettings === 'object' && !Array.isArray(club.attendanceDisplaySettings))
        ? club.attendanceDisplaySettings
        : null;
      const metaLevelSettings = (club?.evidenceSessionMeta?.attendanceDisplaySettings && typeof club.evidenceSessionMeta.attendanceDisplaySettings === 'object' && !Array.isArray(club.evidenceSessionMeta.attendanceDisplaySettings))
        ? club.evidenceSessionMeta.attendanceDisplaySettings
        : null;

      if (isNonEmptyObject(clubLevelSettings)) {
        return { settings: clubLevelSettings };
      }

      if (isNonEmptyObject(metaLevelSettings)) {
        return { settings: metaLevelSettings };
      }

      return { settings: {} };
    };

    const readFromTrainingDisplayFallback = async () => {
      try {
        const response = await this.request('/clubs/my-club/training-exercise-display-settings');
        const rootSettings = (response?.settings && typeof response.settings === 'object' && !Array.isArray(response.settings))
          ? response.settings
          : {};
        const nestedSettings = (rootSettings?.attendanceDisplaySettings && typeof rootSettings.attendanceDisplaySettings === 'object' && !Array.isArray(rootSettings.attendanceDisplaySettings))
          ? rootSettings.attendanceDisplaySettings
          : {};

        if (isNonEmptyObject(nestedSettings)) {
          return { settings: nestedSettings };
        }
      } catch {
        // Ignore unavailable compatibility endpoint.
      }

      return { settings: {} };
    };

    let endpointSettings = {};

    try {
      const response = await this.request('/clubs/my-club/attendance-display-settings');
      endpointSettings = (response?.settings && typeof response.settings === 'object' && !Array.isArray(response.settings))
        ? response.settings
        : {};
    } catch (error) {
      if (!this.isEndpointNotFound(error)) {
        throw error;
      }
    }

    const fallbackResponse = await readFromMyClubFallback();
    const fallbackSettings = (fallbackResponse?.settings && typeof fallbackResponse.settings === 'object' && !Array.isArray(fallbackResponse.settings))
      ? fallbackResponse.settings
      : {};
    const trainingFallbackResponse = await readFromTrainingDisplayFallback();
    const trainingFallbackSettings = (trainingFallbackResponse?.settings && typeof trainingFallbackResponse.settings === 'object' && !Array.isArray(trainingFallbackResponse.settings))
      ? trainingFallbackResponse.settings
      : {};

    const mergedFallbackSettings = pickNewestSettings(fallbackSettings, trainingFallbackSettings);

    return {
      settings: pickNewestSettings(endpointSettings, mergedFallbackSettings)
    };
  }

  async updateAttendanceDisplaySettings(settings) {
    if (USE_MOCK_DATA) {
      return { message: 'Display settings updated (mock)', settings: settings && typeof settings === 'object' ? settings : {} };
    }

    const normalizedSettings = (settings && typeof settings === 'object' && !Array.isArray(settings)) ? settings : {};
    const savedSettings = {
      ...normalizedSettings,
      _savedAt: new Date().toISOString()
    };

    const mirrorToCompatibilitySources = async () => {
      const club = await this.getMyClub();
      const clubName = String(club?.name || '').trim();
      const currentMeta = (club?.evidenceSessionMeta && typeof club.evidenceSessionMeta === 'object' && !Array.isArray(club.evidenceSessionMeta))
        ? club.evidenceSessionMeta
        : {};

      // Legacy my-club payload mirror.
      await this.updateMyClub({
        name: clubName,
        attendanceDisplaySettings: savedSettings,
        evidenceSessionMeta: {
          ...currentMeta,
          attendanceDisplaySettings: savedSettings
        }
      });

      // Secondary server-side mirror in training display settings.
      try {
        const trainingResponse = await this.request('/clubs/my-club/training-exercise-display-settings');
        const currentTrainingSettings = (trainingResponse?.settings && typeof trainingResponse.settings === 'object' && !Array.isArray(trainingResponse.settings))
          ? trainingResponse.settings
          : {};

        await this.request('/clubs/my-club/training-exercise-display-settings', {
          method: 'PUT',
          body: JSON.stringify({
            settings: {
              ...currentTrainingSettings,
              attendanceDisplaySettings: savedSettings
            }
          })
        });
      } catch {
        // Keep compatibility mirror best-effort.
      }
    };

    try {
      const response = await this.request('/clubs/my-club/attendance-display-settings', {
        method: 'PUT',
        body: JSON.stringify({
          settings: savedSettings
        }),
      });

      // Keep compatibility mirrors so refresh reads are stable
      // even when backend deployments split between multiple settings storages.
      try {
        await mirrorToCompatibilitySources();
      } catch {
        // Dedicated endpoint save already succeeded; do not fail the action on mirror write.
      }

      return {
        ...response,
        settings: savedSettings
      };
    } catch (error) {
      if (!this.isEndpointNotFound(error)) {
        throw error;
      }

      // Compatibility fallback for older backends that do not expose dedicated endpoint yet.
      await mirrorToCompatibilitySources();

      return {
        message: 'Nastavenie zobrazenia ukazovateľov bolo uložené (kompatibilný režim).',
        settings: savedSettings
      };
    }
  }

  async getTrainingExerciseDisplaySettings() {
    if (USE_MOCK_DATA) {
      return { settings: {} };
    }

    return this.request('/clubs/my-club/training-exercise-display-settings');
  }

  async updateTrainingExerciseDisplaySettings(settings) {
    if (USE_MOCK_DATA) {
      return { message: 'Training display settings updated (mock)', settings: settings && typeof settings === 'object' ? settings : {} };
    }

    return this.request('/clubs/my-club/training-exercise-display-settings', {
      method: 'PUT',
      body: JSON.stringify({
        settings: settings && typeof settings === 'object' ? settings : {}
      }),
    });
  }

  // Exercises
  async getExercises(params = {}) {
    if (USE_MOCK_DATA) {
      return { total: 0, exercises: [] };
    }

    const query = new URLSearchParams(params).toString();
    const suffix = query ? `?${query}` : '';
    return this.request(`/exercises${suffix}`);
  }

  async getExerciseCategories() {
    if (USE_MOCK_DATA) {
      return { total: 0, categories: [] };
    }

    return this.request('/exercises/categories');
  }

  async createExerciseCategory(data) {
    if (USE_MOCK_DATA) {
      return {
        id: Date.now(),
        message: 'Exercise category created (mock)',
        category: {
          id: Date.now(),
          name: String(data?.name || '').trim(),
          isSystem: Boolean(data?.isSystem),
          clubId: data?.clubId || null
        }
      };
    }

    return this.request('/exercises/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateExerciseCustomCategories(exerciseId, customLabels) {
    if (USE_MOCK_DATA) {
      return {
        message: 'Exercise custom categories updated (mock)',
        exercise: {
          id: exerciseId,
          customLabels: Array.isArray(customLabels) ? customLabels : []
        }
      };
    }

    return this.request(`/exercises/${exerciseId}/custom-categories`, {
      method: 'PATCH',
      body: JSON.stringify({
        customLabels: Array.isArray(customLabels) ? customLabels : []
      }),
    });
  }

  async createExercise(data) {
    if (USE_MOCK_DATA) {
      return {
        id: Date.now(),
        message: 'Exercise created (mock)',
        exercise: {
          id: Date.now(),
          title: data?.title || '',
          isSystem: Boolean(data?.isSystem),
          clubId: data?.clubId || null
        }
      };
    }

    return this.request('/exercises', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async previewExerciseChannelImport(data) {
    if (USE_MOCK_DATA) {
      return {
        channel: {
          id: 'UC_MOCK_CHANNEL',
          title: 'Mock YouTube Channel',
          sourceUrl: String(data?.channelUrl || '')
        },
        total: 0,
        videos: []
      };
    }

    return this.request('/exercises/import/channel/preview', {
      method: 'POST',
      body: JSON.stringify(data && typeof data === 'object' ? data : {}),
    });
  }

  async importExercisesFromChannel(data) {
    if (USE_MOCK_DATA) {
      return {
        createdCount: Array.isArray(data?.selectedVideoIds) ? data.selectedVideoIds.length : 0,
        skippedExistingCount: 0,
        message: 'Bulk import completed (mock)'
      };
    }

    return this.request('/exercises/import/channel', {
      method: 'POST',
      body: JSON.stringify(data && typeof data === 'object' ? data : {}),
    });
  }

  async updateExercise(exerciseId, data) {
    if (USE_MOCK_DATA) {
      return {
        message: 'Exercise updated (mock)',
        exercise: {
          id: exerciseId,
          ...data
        }
      };
    }

    return this.request(`/exercises/${exerciseId}`, {
      method: 'PUT',
      body: JSON.stringify(data && typeof data === 'object' ? data : {}),
    });
  }

  async deleteExercise(exerciseId) {
    if (USE_MOCK_DATA) {
      return { message: 'Exercise deleted (mock)', id: exerciseId };
    }

    return this.request(`/exercises/${exerciseId}`, {
      method: 'DELETE',
    });
  }

  // Dashboard Stats
  async getDashboardStats() {
    if (USE_MOCK_DATA) {
      return {
        totalPlayers: 47,
        totalTeams: 5,
        upcomingTrainings: 3,
        upcomingMatches: 2,
        recentTests: 12
      };
    }
    // Agreguje data z různých endpointů
    const [players, teams, trainings, matches] = await Promise.all([
      this.getPlayers(),
      this.getTeams(),
      this.getTrainings({ status: 'scheduled', limit: 10 }),
      this.getMatches({ status: 'scheduled', limit: 10 })
    ]);
    
    return {
      totalPlayers: players.total,
      totalTeams: teams.total,
      upcomingTrainings: trainings.total,
      upcomingMatches: matches.total,
      recentTests: 0
    };
  }
}

export const api = new APIClient(API_BASE_URL);
export { USE_MOCK_DATA };
