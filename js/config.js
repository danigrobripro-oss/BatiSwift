/**
 * BâtiSwift — config.js
 * UNIQUEMENT les constantes de configuration.
 * Doit être chargé EN PREMIER sur toutes les pages.
 */
const CONFIG = {
  API_URL:   (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
               ? 'http://localhost:8000'
               : 'https://agent-btp.onrender.com',
  TOKEN_KEY:   'batiswift_token',
  USER_KEY:    'batiswift_user',
  CONTEXT_KEY: 'batiswift_context',
  VERSION:     '2.0.0',
};