import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom'
import { api, getApiMode, setUseMockData } from './api'
import Dashboard from './pages/Dashboard'
import Clubs from './pages/Clubs'
import Players from './pages/Players'
import Teams from './pages/Teams'
import Trainings from './pages/Trainings'
import Matches from './pages/Matches'
import Tests from './pages/Tests'
import RegistrationApprovals from './pages/RegistrationApprovals'
import Login from './pages/Login'
import './App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [useMockData, setUseMockDataState] = useState(getApiMode())

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('authToken')
    const user = localStorage.getItem('user')
    
    if (token && user) {
      setIsAuthenticated(true)
      setCurrentUser(JSON.parse(user))
      api.setToken(token)
    }
    setLoading(false)
  }, [])

  const handleLogin = (token, user) => {
    api.setToken(token)
    localStorage.setItem('user', JSON.stringify(user))
    setCurrentUser(user)
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    api.clearToken()
    localStorage.removeItem('user')
    setCurrentUser(null)
    setIsAuthenticated(false)
  }

  const toggleMockData = () => {
    const newValue = !useMockData;
    setUseMockData(newValue);
    setUseMockDataState(newValue);
    // Force refresh stránky pro aplikování změn
    window.location.reload();
  }

  if (loading) {
    return <div className="loading">Načítání...</div>
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <Router>
      <div className="app">
        <nav className="sidebar">
          <div className="sidebar-header">
            <h1>⬢ Sports Club</h1>
            <p className="user-info">{currentUser?.firstName} {currentUser?.lastName}</p>
          </div>
          
          <div className="nav-links">
            <Link to="/" className="nav-link">
              <span className="icon">▣</span>
              Dashboard
            </Link>
            <Link to="/clubs" className="nav-link">
              <span className="icon">⬢</span>
              Kluby
            </Link>
            <Link to="/players" className="nav-link">
              <span className="icon">◉</span>
              Hráči
            </Link>
            <Link to="/teams" className="nav-link">
              <span className="icon">★</span>
              Týmy
            </Link>
            <Link to="/trainings" className="nav-link">
              <span className="icon">●</span>
              Tréninky
            </Link>
            <Link to="/matches" className="nav-link">
              <span className="icon">⬢</span>
              Zápasy
            </Link>
            <Link to="/tests" className="nav-link">
              <span className="icon">▲</span>
              Testy
            </Link>
            <Link to="/registrations" className="nav-link">
              <span className="icon">✓</span>
              Registrácie
            </Link>
          </div>

          <div className="sidebar-footer">
            <div className="api-mode-toggle">
              <label className="toggle-label">
                <span className="toggle-text">
                  {useMockData ? '🧪 Mock Data' : '🌐 Real API'}
                </span>
                <div className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={!useMockData}
                    onChange={toggleMockData}
                  />
                  <span className="slider"></span>
                </div>
              </label>
            </div>
            <button onClick={handleLogout} className="btn btn-secondary">
              Odhlásit se
            </button>
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clubs" element={<Clubs />} />
            <Route path="/players" element={<Players />} />
            <Route path="/registrations" element={<RegistrationApprovals />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/trainings" element={<Trainings />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/tests" element={<Tests />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
