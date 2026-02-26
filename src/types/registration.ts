// ============================================
// USER TYPES
// ============================================

export type UserRole = 
  | 'admin'
  | 'club_admin'
  | 'coach'
  | 'assistant'
  | 'player'
  | 'parent'
  | 'private_coach';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
  dateOfBirth?: string;
  avatarUrl?: string;
  isActive: boolean;
  isVerified: boolean;
  isVirtual: boolean;
  parentId?: number;
  coppaConsentGiven: boolean;
  ageVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VirtualPlayer extends Omit<User, 'email' | 'isVerified'> {
  isVirtual: true;
  role: 'player';
}

// ============================================
// CLUB TYPES
// ============================================

export interface Club {
  id: number;
  name: string;
  shortName?: string;
  description?: string;
  logoUrl?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country: string;
  phone?: string;
  email?: string;
  website?: string;
  ownerId: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClubMember {
  id: number;
  clubId: number;
  userId: number;
  memberRole: 'club_admin' | 'coach' | 'assistant' | 'player';
  joinedAt: string;
  leftAt?: string;
  isActive: boolean;
  addedBy?: number;
  user?: User;
}

// ============================================
// TEAM TYPES
// ============================================

export interface Team {
  id: number;
  clubId: number;
  name: string;
  category: string;
  ageGroup?: string;
  season?: string;
  coachId?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  coach?: User;
  club?: Club;
}

export interface TeamMembership {
  id: number;
  teamId: number;
  userId: number;
  jerseyNumber?: number;
  position?: string;
  joinedDate?: string;
  leftDate?: string;
  isActive: boolean;
  player?: User;
  team?: Team;
}

// ============================================
// RELATIONSHIP TYPES
// ============================================

export interface ParentChildLink {
  id: number;
  parentId: number;
  childId: number;
  relationshipType: 'mother' | 'father' | 'guardian' | 'other';
  isPrimary: boolean;
  canManage: boolean;
  canView: boolean;
  createdAt: string;
  parent?: User;
  child?: User;
}

export interface PrivateCoachPlayer {
  id: number;
  coachId: number;
  playerId: number;
  assignedAt: string;
  assignedBy?: number;
  isActive: boolean;
  notes?: string;
  coach?: User;
  player?: User;
}

export interface CoachAssistant {
  id: number;
  coachId: number;
  assistantId: number;
  clubId: number;
  teamId?: number;
  canCreateTrainings: boolean;
  canEditTrainings: boolean;
  canViewAnalytics: boolean;
  assignedAt: string;
  assignedBy?: number;
  isActive: boolean;
  coach?: User;
  assistant?: User;
  club?: Club;
  team?: Team;
}

// ============================================
// INVITE TYPES
// ============================================

export type InviteType = 'coach' | 'assistant' | 'player' | 'parent' | 'club_admin';
export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface Invite {
  id: number;
  inviteCode: string;
  inviteType: InviteType;
  email: string;
  invitedBy: number;
  clubId?: number;
  teamId?: number;
  playerId?: number;
  metadata?: Record<string, any>;
  status: InviteStatus;
  expiresAt: string;
  acceptedAt?: string;
  acceptedBy?: number;
  createdAt: string;
  inviter?: User;
  club?: Club;
  team?: Team;
}

// ============================================
// CONSENT TYPES
// ============================================

export type ConsentType = 'coppa' | 'gdpr' | 'terms' | 'privacy' | 'marketing';

export interface ConsentRecord {
  id: number;
  userId: number;
  consentType: ConsentType;
  givenBy?: number;
  consentGiven: boolean;
  ipAddress?: string;
  userAgent?: string;
  consentText?: string;
  consentVersion?: string;
  createdAt: string;
  user?: User;
  givenByUser?: User;
}

// ============================================
// VERIFICATION TYPES
// ============================================

export interface EmailVerification {
  id: number;
  userId: number;
  token: string;
  email: string;
  expiresAt: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface PasswordReset {
  id: number;
  email: string;
  token: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
}

// ============================================
// REGISTRATION TYPES
// ============================================

export interface ClubRegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  clubName: string;
  country: string;
  city?: string;
  address?: string;
  logoUrl?: string;
}

export interface CoachRegistrationData {
  inviteCode: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;
}

export interface PrivateCoachRegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  country?: string;
  bio?: string;
}

export interface AssistantRegistrationData {
  inviteCode: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface PlayerRegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  position?: string;
  preferredFoot?: 'left' | 'right' | 'both';
  height?: number;
  weight?: number;
  parentEmail?: string;
  parentFirstName?: string;
  parentLastName?: string;
  parentPassword?: string;
  inviteCode?: string;
}

export interface ParentRegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface VirtualPlayerData {
  firstName: string;
  lastName: string;
  teamId: number;
  dateOfBirth?: string;
  position?: string;
  jerseyNumber?: number;
  height?: number;
  weight?: number;
  preferredFoot?: 'left' | 'right' | 'both';
}

export interface ConvertVirtualPlayerData {
  parentEmail: string;
  parentFirstName: string;
  parentLastName: string;
  playerEmail?: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = any> {
  message?: string;
  data?: T;
  error?: string;
  errors?: Array<{ msg: string; param: string }>;
}

export interface PaginatedResponse<T> {
  total: number;
  page?: number;
  limit?: number;
  items: T[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegistrationResponse {
  message: string;
  user: Partial<User>;
  club?: Partial<Club>;
  requiresParentConsent?: boolean;
  clubId?: number;
}

// ============================================
// FORM STATE TYPES
// ============================================

export interface RegistrationFormState {
  step: number;
  registerAs: 'club' | 'coach' | 'assistant' | 'player' | 'parent' | 'private_coach';
  basicData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  };
  clubData?: Partial<ClubRegistrationData>;
  coachData?: Partial<CoachRegistrationData>;
  playerData?: Partial<PlayerRegistrationData>;
  parentData?: Partial<ParentRegistrationData>;
  inviteData?: Invite;
}

// ============================================
// PERMISSION HELPERS
// ============================================

export const canCreateTraining = (role: UserRole): boolean => {
  return ['admin', 'club_admin', 'coach', 'private_coach'].includes(role);
};

export const canManagePlayers = (role: UserRole): boolean => {
  return ['admin', 'club_admin', 'coach'].includes(role);
};

export const canManageClub = (role: UserRole): boolean => {
  return ['admin', 'club_admin'].includes(role);
};

export const canInviteCoach = (role: UserRole): boolean => {
  return ['admin', 'club_admin'].includes(role);
};

export const canInviteAssistant = (role: UserRole): boolean => {
  return ['admin', 'club_admin', 'coach'].includes(role);
};

export const canViewAnalytics = (role: UserRole): boolean => {
  return ['admin', 'club_admin', 'coach', 'private_coach'].includes(role);
};

export const isClubMember = (role: UserRole): boolean => {
  return ['club_admin', 'coach', 'assistant', 'player'].includes(role);
};

export const requiresParentConsent = (dateOfBirth: string): boolean => {
  const age = calculateAge(dateOfBirth);
  return age < 16;
};

export const calculateAge = (dateOfBirth: string): number => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};
