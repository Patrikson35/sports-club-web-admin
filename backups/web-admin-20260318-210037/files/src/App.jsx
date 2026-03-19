import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import { api } from './api'
import Dashboard from './pages/Dashboard'
import Clubs from './pages/Clubs'
import MyClub from './pages/MyClub'
import Players from './pages/Players'
import Teams from './pages/Teams'
import Trainings from './pages/Trainings'
import Matches from './pages/Matches'
import Tests from './pages/Tests'
import Exercises from './pages/Exercises'
import RegistrationApprovals from './pages/RegistrationApprovals'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import ParentConsent from './pages/ParentConsent'
import CompleteProfileClub from './pages/CompleteProfileClub'
import CompleteProfileCoach from './pages/CompleteProfileCoach'
import CompleteProfilePlayer from './pages/CompleteProfilePlayer'
import ClubPermissions from './pages/ClubPermissions'
import SectionPlaceholder from './pages/SectionPlaceholder'
import Evidence from './pages/Evidence'
import Planner from './pages/Planner'
import './App.css'

const normalizeRole = (role) => (role === 'club_admin' ? 'club' : role)

const normalizeClubLogoUrl = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.startsWith('/uploads/')) {
    return `/api${raw}`
  }
  return raw
}

const roleSections = {
  club: ['categories', 'coaches', 'players', 'attendance', 'matches', 'trainings', 'exercises', 'tests', 'membershipFees', 'communication'],
  coach: ['categories', 'players', 'attendance', 'matches', 'trainings', 'exercises', 'tests', 'communication'],
  assistant: ['categories', 'players', 'attendance', 'matches', 'trainings', 'exercises', 'tests', 'communication'],
  parent: ['attendance', 'matches', 'trainings', 'tests', 'membershipFees', 'communication'],
  player: ['attendance', 'matches', 'trainings', 'tests'],
  private_coach: ['categories', 'players', 'attendance', 'trainings', 'exercises', 'tests', 'communication'],
  admin: ['clubs', 'categories', 'coaches', 'players', 'attendance', 'matches', 'trainings', 'exercises', 'tests', 'membershipFees', 'communication', 'registrations']
}

const getRoleSections = (role, remoteSections) => {
  const normalizedRole = normalizeRole(role)
  const fallback = roleSections[normalizedRole] || []

  if (!Array.isArray(remoteSections)) {
    return fallback
  }

  return remoteSections
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [remoteVisibleRole, setRemoteVisibleRole] = useState(null)
  const [remoteVisibleSections, setRemoteVisibleSections] = useState(null)
  const location = useLocation()
  const isCompleteProfileRoute = location.pathname.startsWith('/complete-profile/')
  const currentRole = normalizeRole(currentUser?.role)
  const currentUserPermissionSet = new Set([
    ...(Array.isArray(currentUser?.permissions) ? currentUser.permissions : []),
    ...(Array.isArray(currentUser?.delegatedPermissions) ? currentUser.delegatedPermissions : []),
    ...(Array.isArray(currentUser?.effectivePermissions) ? currentUser.effectivePermissions : [])
  ].map((permission) => String(permission || '').trim()).filter(Boolean))
  const canOpenSettings = currentRole === 'club' || currentUserPermissionSet.has('fields.manage')
  const canUseRemoteSections = (
    (currentRole === 'assistant' && remoteVisibleRole === 'coach') ||
    remoteVisibleRole === currentRole
  )
  const allowedSections = getRoleSections(currentRole, canUseRemoteSections ? remoteVisibleSections : null)
  const canAccessSection = (sectionKey) => allowedSections.includes(sectionKey)

  const sidebarSections = [
    { key: 'clubs', to: '/clubs', icon: 'dashboard', label: 'Kluby' },
    { key: 'categories', to: '/teams', icon: 'category', label: 'Kategórie' },
    { key: 'coaches', to: '/coaches', icon: 'group', label: 'Tréneri' },
    { key: 'players', to: '/players', icon: 'person', label: 'Hráči' },
    { key: 'attendance', to: '/attendance', icon: 'event_available', label: 'Dochádzka' },
    { key: 'planner', to: '/planner', icon: 'event_note', label: 'Plánovač' },
    { key: 'matches', to: '/matches', icon: 'sports_soccer', label: 'Zápasy' },
    { key: 'trainings', to: '/trainings', icon: 'fitness_center', label: 'Tréningy' },
    { key: 'exercises', to: '/exercises', icon: 'psychology', label: 'Cvičenia' },
    { key: 'tests', to: '/tests', icon: 'assignment', label: 'Testy' },
    { key: 'membershipFees', to: '/membership-fees', icon: 'payments', label: 'Členské poplatky' },
    { key: 'communication', to: '/communication', icon: 'manage_accounts', label: 'Komunikácia' },
    { key: 'registrations', to: '/registrations', icon: 'assignment', label: 'Registrácie' }
  ]

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

  useEffect(() => {
    const loadClubName = async () => {
      if (!isAuthenticated || currentUser?.role !== 'club') {
        return
      }

      try {
        const club = await api.getMyClub()
        if (club?.name || club?.logo_url || club?.logoUrl || club?.logo) {
          setCurrentUser(prev => {
            if (!prev) {
              return prev
            }

            const nextClubName = club?.name || prev.clubName
            const nextClubLogo = normalizeClubLogoUrl(club?.logo_url || club?.logoUrl || club?.logo || '')

            if (prev.clubName === nextClubName && prev.clubLogoUrl === nextClubLogo) {
              return prev
            }

            const updatedUser = {
              ...prev,
              clubName: nextClubName,
              clubLogoUrl: nextClubLogo
            }
            localStorage.setItem('user', JSON.stringify(updatedUser))
            return updatedUser
          })
        }
      } catch (error) {
        // Club not created yet or temporary API error - keep current header fallback
      }
    }

    loadClubName()
  }, [isAuthenticated, currentUser?.role])

  useEffect(() => {
    setIsSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const refreshVisibleSections = async () => {
      if (!isAuthenticated) {
        setRemoteVisibleRole(null)
        setRemoteVisibleSections(null)
        return
      }

      try {
        const result = await api.getMyVisibleSections()
        const normalizedRole = result?.role ? normalizeRole(String(result.role)) : null

        if (Array.isArray(result?.sections)) {
          setRemoteVisibleRole(normalizedRole)
          setRemoteVisibleSections(result.sections)
          return
        }

        if (result?.roles && typeof result.roles === 'object') {
          const currentNormalizedRole = normalizeRole(currentUser?.role)
          const roleKey = currentNormalizedRole === 'assistant' ? 'coach' : currentNormalizedRole
          const roleSectionsFromResult = Array.isArray(result.roles?.[roleKey]) ? result.roles[roleKey] : null
          if (roleSectionsFromResult) {
            setRemoteVisibleRole(roleKey)
            setRemoteVisibleSections(roleSectionsFromResult)
            return
          }
        }

        setRemoteVisibleRole(normalizedRole)
        setRemoteVisibleSections(null)
      } catch {
        setRemoteVisibleRole(null)
        setRemoteVisibleSections(null)
      }
    }

    const handleSectionsUpdate = (event) => {
      const payloadRoles = event?.detail?.roles
      if (payloadRoles && typeof payloadRoles === 'object') {
        const currentNormalizedRole = normalizeRole(currentUser?.role)
        const roleKey = currentNormalizedRole === 'assistant' ? 'coach' : currentNormalizedRole
        const payloadSections = Array.isArray(payloadRoles?.[roleKey]) ? payloadRoles[roleKey] : null

        if (payloadSections) {
          setRemoteVisibleRole(roleKey)
          setRemoteVisibleSections(payloadSections)
          return
        }
      }

      refreshVisibleSections()
    }

    window.addEventListener('visible-sections-updated', handleSectionsUpdate)
    refreshVisibleSections()

    return () => {
      window.removeEventListener('visible-sections-updated', handleSectionsUpdate)
    }
  }, [isAuthenticated, currentUser?.id, currentUser?.role])

  useEffect(() => {
    if (!isSidebarOpen) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsSidebarOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSidebarOpen])

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

  const openSidebar = () => setIsSidebarOpen((prev) => !prev)
  const closeSidebar = () => setIsSidebarOpen(false)

  if (loading) {
    return <div className="loading">Načítání...</div>
  }

  return (
      !isAuthenticated ? (
        // Public routes - no authentication required
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/parent-consent" element={<ParentConsent />} />
          <Route path="/complete-profile/club" element={<CompleteProfileClub />} />
          <Route path="/complete-profile/coach" element={<CompleteProfileCoach />} />
          <Route path="/complete-profile/player" element={<CompleteProfilePlayer />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      ) : isCompleteProfileRoute ? (
        // Complete profile routes without sidebar layout
        <Routes>
          <Route path="/complete-profile/club" element={<CompleteProfileClub />} />
          <Route path="/complete-profile/coach" element={<CompleteProfileCoach />} />
          <Route path="/complete-profile/player" element={<CompleteProfilePlayer />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      ) : (
        // Private routes - authentication required
        <div className="app">
          <button
            type="button"
            className="sidebar-hamburger"
            onClick={openSidebar}
            aria-label={isSidebarOpen ? 'Zavrieť menu' : 'Otvoriť menu'}
          >
            <span className="material-icons-round" aria-hidden="true">{isSidebarOpen ? 'close' : 'menu'}</span>
          </button>

          {isSidebarOpen ? <button type="button" className="sidebar-overlay" onClick={closeSidebar} aria-label="Zavrieť menu" /> : null}

          <nav className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
              <div className="sidebar-brand">
                <Link to="/" className="sidebar-home-link" onClick={closeSidebar}>
                  {currentUser?.clubLogoUrl ? (
                    <img
                      src={currentUser.clubLogoUrl}
                      alt="Logo klubu"
                      className="club-logo"
                    />
                  ) : (
                    <span className="club-logo-fallback material-icons-round">stars</span>
                  )}
                  <div className="sidebar-brand-text">
                    <h1 className="sidebar-brand-title">{currentUser?.clubName || 'Názov klubu'}</h1>
                    <p className="user-info">{currentUser?.firstName} {currentUser?.lastName}</p>
                  </div>
                </Link>
              </div>
            </div>
            
            <div className="nav-links">
              <Link to="/" className="nav-link" onClick={closeSidebar}>
                <span className="icon material-icons-round">dashboard</span>
                Dashboard
              </Link>

              {sidebarSections
                .filter((section) => canAccessSection(section.key))
                .map((section) => (
                  <Link key={section.key} to={section.to} className="nav-link" onClick={closeSidebar}>
                    <span className="icon material-icons-round">{section.icon}</span>
                    {section.label}
                  </Link>
                ))}
            </div>

            <div className="sidebar-footer">
              {canOpenSettings && (
                <>
                  <Link to="/my-club" className="nav-link settings-link" onClick={closeSidebar}>
                    <span className="icon material-icons-round">settings</span>
                    Nastavenia
                  </Link>
                </>
              )}
              <button onClick={handleLogout} className="btn btn-secondary">
                <span className="icon material-icons-round">logout</span>
                Odhlásit se
              </button>
            </div>
          </nav>

          <main className="main-content">
            <Routes>
              <Route path="/complete-profile/club" element={<CompleteProfileClub />} />
              <Route path="/complete-profile/coach" element={<CompleteProfileCoach />} />
              <Route path="/complete-profile/player" element={<CompleteProfilePlayer />} />
              <Route path="/" element={<Dashboard />} />
              <Route path="/clubs" element={canAccessSection('clubs') ? <Clubs /> : <Navigate to="/" />} />
              <Route path="/my-club" element={canOpenSettings ? <MyClub /> : <Navigate to="/" />} />
              <Route path="/club-permissions" element={currentRole === 'club' ? <ClubPermissions /> : <Navigate to="/" />} />
              <Route path="/teams" element={canAccessSection('categories') ? <Teams /> : <Navigate to="/" />} />
              <Route path="/coaches" element={canAccessSection('coaches') ? <SectionPlaceholder title="Tréneri" description="Prehľad trénerov a asistentov" /> : <Navigate to="/" />} />
              <Route path="/players" element={canAccessSection('players') ? <Players /> : <Navigate to="/" />} />
              <Route path="/attendance" element={canAccessSection('attendance') ? <Evidence /> : <Navigate to="/" />} />
              <Route path="/planner" element={canAccessSection('planner') ? <Planner /> : <Navigate to="/" />} />
              <Route path="/matches" element={canAccessSection('matches') ? <Matches /> : <Navigate to="/" />} />
              <Route path="/trainings" element={canAccessSection('trainings') ? <Trainings /> : <Navigate to="/" />} />
              <Route path="/exercises" element={canAccessSection('exercises') ? <Exercises /> : <Navigate to="/" />} />
              <Route path="/tests" element={canAccessSection('tests') ? <Tests /> : <Navigate to="/" />} />
              <Route path="/membership-fees" element={canAccessSection('membershipFees') ? <SectionPlaceholder title="Členské poplatky" description="Evidencia členských poplatkov" /> : <Navigate to="/" />} />
              <Route path="/communication" element={canAccessSection('communication') ? <SectionPlaceholder title="Komunikácia" description="Správy, notifikácie a komunikácia" /> : <Navigate to="/" />} />
              <Route path="/registrations" element={canAccessSection('registrations') ? <RegistrationApprovals /> : <Navigate to="/" />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      )
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App
