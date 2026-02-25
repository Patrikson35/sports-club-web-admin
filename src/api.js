// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Načtení nastavení z localStorage
const getUseMockData = () => {
  const saved = localStorage.getItem('useMockData');
  return saved === null ? true : saved === 'true';
};

let USE_MOCK_DATA = getUseMockData();

// Export funkce pro změnu režimu
export const setUseMockData = (value) => {
  USE_MOCK_DATA = value;
  localStorage.setItem('useMockData', value.toString());
};

export const getApiMode = () => USE_MOCK_DATA; // Přepnout na false pro reálné API

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

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Auth
  async login(email, password) {
    if (USE_MOCK_DATA) {
      return {
        token: 'mock_token_12345',
        user: { id: 1, email, firstName: 'Admin', lastName: 'User', role: 'admin' }
      };
    }
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
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

  // Teams
  async getTeams() {
    if (USE_MOCK_DATA) {
      return {
        total: 5,
        teams: [
          { id: 1, name: 'U7', ageGroup: 'U7', playerCount: 12 },
          { id: 2, name: 'U9', ageGroup: 'U9', playerCount: 10 },
          { id: 3, name: 'U11', ageGroup: 'U11', playerCount: 15 },
        ]
      };
    }
    return this.request('/teams');
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
