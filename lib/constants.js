export const APP_NAME = "Coperto";
export const SESSION_COOKIE_NAME = "coperto_session";
export const SESSION_DURATION_DAYS = 30;

export const ROLE_LABELS = {
  ADMIN: "Admin",
  PROPRIETARIO: "Proprietario",
  STORE_MANAGER: "Store Manager",
  STAFF: "Staff"
};

export const RESERVATION_STATUS_LABELS = {
  IN_ATTESA: "In attesa",
  CONFERMATA: "Confermata",
  IN_CORSO: "In corso",
  COMPLETATA: "Completata",
  CANCELLATA: "Cancellata",
  NO_SHOW: "No show"
};

export const TABLE_SESSION_STATUS_LABELS = {
  OPEN: "Sessione aperta",
  PAYMENT_REQUESTED: "Pagamento richiesto",
  PAID: "Pagato",
  CLOSED: "Chiuso"
};

export const ADMIN_PAGE_LABELS = {
  dashboard: "Dashboard",
  locations: "Sedi",
  tables: "Tavoli",
  menus: "Menu",
  hours: "Orari",
  reservations: "Prenotazioni",
  users: "Utenti",
  console: "Console Admin"
};

export const DEFAULT_ROLE_PERMISSIONS = {
  ADMIN: {
    canViewDashboard: true,
    canViewLocations: true,
    canManageLocations: true,
    canViewTables: true,
    canManageTables: true,
    canDeleteTables: true,
    canViewMenus: true,
    canManageMenus: true,
    canViewHours: true,
    canManageHours: true,
    canViewReservations: true,
    canManageReservations: true,
    canViewUsers: true,
    canManageUsers: true,
    canViewConsoleAdmin: true,
    canManageConsoleAdmin: true
  },
  PROPRIETARIO: {
    canViewDashboard: true,
    canViewLocations: true,
    canManageLocations: true,
    canViewTables: true,
    canManageTables: true,
    canDeleteTables: true,
    canViewMenus: true,
    canManageMenus: true,
    canViewHours: true,
    canManageHours: true,
    canViewReservations: true,
    canManageReservations: true,
    canViewUsers: true,
    canManageUsers: true,
    canViewConsoleAdmin: false,
    canManageConsoleAdmin: false
  },
  STORE_MANAGER: {
    canViewDashboard: true,
    canViewLocations: false,
    canManageLocations: false,
    canViewTables: true,
    canManageTables: true,
    canDeleteTables: false,
    canViewMenus: true,
    canManageMenus: true,
    canViewHours: true,
    canManageHours: true,
    canViewReservations: true,
    canManageReservations: true,
    canViewUsers: false,
    canManageUsers: false,
    canViewConsoleAdmin: false,
    canManageConsoleAdmin: false
  },
  STAFF: {
    canViewDashboard: true,
    canViewLocations: false,
    canManageLocations: false,
    canViewTables: false,
    canManageTables: false,
    canDeleteTables: false,
    canViewMenus: false,
    canManageMenus: false,
    canViewHours: false,
    canManageHours: false,
    canViewReservations: true,
    canManageReservations: false,
    canViewUsers: false,
    canManageUsers: false,
    canViewConsoleAdmin: false,
    canManageConsoleAdmin: false
  }
};

export const WEEKDAYS = [
  { value: 1, label: "Lunedi" },
  { value: 2, label: "Martedi" },
  { value: 3, label: "Mercoledi" },
  { value: 4, label: "Giovedi" },
  { value: 5, label: "Venerdi" },
  { value: 6, label: "Sabato" },
  { value: 0, label: "Domenica" }
];

export const DEFAULT_OPENING_HOURS = [
  { weekday: 1, opensAt: "12:00", closesAt: "23:00", isClosed: false },
  { weekday: 2, opensAt: "12:00", closesAt: "23:00", isClosed: false },
  { weekday: 3, opensAt: "12:00", closesAt: "23:00", isClosed: false },
  { weekday: 4, opensAt: "12:00", closesAt: "23:00", isClosed: false },
  { weekday: 5, opensAt: "12:00", closesAt: "23:30", isClosed: false },
  { weekday: 6, opensAt: "12:00", closesAt: "23:30", isClosed: false },
  { weekday: 0, opensAt: "12:00", closesAt: "22:30", isClosed: false }
];
