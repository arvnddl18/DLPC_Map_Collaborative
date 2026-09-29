/**
 * DLPC_Map_Collaborative - Authentication and Access Control Module
 */

import { CONFIG } from './config.js';

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.sessionToken = null;
    this.shareToken = null;
    this.sharePermission = null;
    this.mapId = null;
    this.listeners = [];
  }

  /**
   * Initializes authentication state from URL parameters or session storage.
   */
  async init() {
    const urlParams = new URLSearchParams(window.location.search);
    this.mapId = urlParams.get('mapId') || window.DLPC_CONFIG?.MAP_ID || 'MAP-DAVAO01';
    this.shareToken = urlParams.get('token') || window.DLPC_CONFIG?.SHARE_TOKEN || null;

    // 1. Check if share token exists
    if (this.shareToken) {
      const verifyRes = await this.verifyShareToken(this.shareToken, this.mapId);
      if (verifyRes.success) {
        this.sharePermission = verifyRes.permission;
        this.currentUser = {
          id: 'GUEST_' + this.shareToken.substring(0, 6),
          name: this.getSavedGuestName() || ('Collaborator (' + verifyRes.permission + ')'),
          role: verifyRes.permission === 'EDIT' ? CONFIG.ROLES.EDITOR : CONFIG.ROLES.VIEWER,
          isGuest: true
        };
        this.notifyListeners();
        return;
      }
    }

    // 2. Check for existing session token in sessionStorage
    const savedToken = sessionStorage.getItem('dlpc_session_token');
    const savedUser = sessionStorage.getItem('dlpc_user');

    if (savedToken && savedUser) {
      try {
        this.sessionToken = savedToken;
        this.currentUser = JSON.parse(savedUser);
        this.notifyListeners();
        return;
      } catch (e) {
        this.logout();
      }
    }

    // 3. Fallback to Viewer guest mode if no credentials
    this.currentUser = {
      id: 'GUEST_ANON',
      name: 'Guest Viewer',
      role: CONFIG.ROLES.VIEWER,
      isGuest: true
    };
    this.notifyListeners();
  }

  /**
   * Logs in with administrator / user credentials.
   */
  async login(email, password) {
    try {
      const response = await fetch(CONFIG.API_BASE_URL || '/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'auth:login',
          email: email,
          password: password
        })
      });

      const res = await response.json();
      if (!res.success) {
        return { success: false, error: res.error || 'Authentication failed.' };
      }

      this.sessionToken = res.sessionToken;
      this.currentUser = res.user;

      sessionStorage.setItem('dlpc_session_token', this.sessionToken);
      sessionStorage.setItem('dlpc_user', JSON.stringify(this.currentUser));

      this.notifyListeners();
      return { success: true, user: this.currentUser };
    } catch (err) {
      return { success: false, error: 'Connection error during authentication: ' + err.message };
    }
  }

  /**
   * Verifies share token against server.
   */
  async verifyShareToken(token, mapId) {
    try {
      const response = await fetch(CONFIG.API_BASE_URL || '/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'share:verify',
          token: token,
          mapId: mapId
        })
      });
      return await response.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  getSavedGuestName() {
    return localStorage.getItem('dlpc_collaborator_name');
  }

  setCollaboratorName(name) {
    if (!name) return;
    localStorage.setItem('dlpc_collaborator_name', name);
    if (this.currentUser) {
      this.currentUser.name = name;
      this.notifyListeners();
    }
  }

  logout() {
    this.sessionToken = null;
    this.currentUser = {
      id: 'GUEST_ANON',
      name: 'Guest Viewer',
      role: CONFIG.ROLES.VIEWER,
      isGuest: true
    };
    sessionStorage.removeItem('dlpc_session_token');
    sessionStorage.removeItem('dlpc_user');
    this.notifyListeners();
  }

  canAdmin() {
    return this.currentUser && this.currentUser.role === CONFIG.ROLES.ADMIN;
  }

  canEdit() {
    if (!this.currentUser) return false;
    return this.currentUser.role === CONFIG.ROLES.ADMIN ||
           this.currentUser.role === CONFIG.ROLES.EDITOR ||
           this.sharePermission === 'EDIT';
  }

  getAuthPayload() {
    return {
      sessionToken: this.sessionToken,
      shareToken: this.shareToken,
      mapId: this.mapId,
      collaboratorName: this.currentUser?.name
    };
  }

  onAuthChange(callback) {
    this.listeners.push(callback);
    callback(this.currentUser);
  }

  notifyListeners() {
    this.listeners.forEach(cb => {
      try { cb(this.currentUser); } catch (e) { console.error(e); }
    });
  }
}

export const auth = new AuthManager();
