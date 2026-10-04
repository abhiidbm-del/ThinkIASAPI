module.exports = {
  ROLES: {
    STUDENT: 'student',
    ADMIN: 'admin'
  },
  USER_TYPES: {
    FRESH: 'fresh',
    PRE: 'pre',
    MAINS: 'mains',
    COMBO: 'combo'
  },
  JWT: {
    SECRET: process.env.JWT_SECRET || 'thinkcivil_secret',
    EXPIRES_IN: '24h',
    REFRESH_EXPIRES_IN: '7d'
  },
  TEST: {
    STATUS: {
      UPCOMING: 'upcoming',
      ACTIVE: 'active',
      COMPLETED: 'completed'
    }
  },
  PAGINATION: {
    DEFAULT_LIMIT: 10,
    DEFAULT_PAGE: 1
  }
};