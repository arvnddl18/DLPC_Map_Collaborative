/**
 * DLPC_Map_Collaborative - Sharing & Access Management Engine
 * Generates and manages cryptographic View-only and Edit-access links.
 */

import { CONFIG } from './config.js';
import { auth } from './auth.js';

export class ShareEngine {
  constructor() {
    this.activeLinks = [];
  }

  async loadLinks(mapId) {
    if (!auth.canAdmin()) return [];
    try {
      const res = await fetch(CONFIG.API_BASE_URL || '/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'share:list',
          mapId: mapId,
          ...auth.getAuthPayload()
        })
      });
      const data = await res.json();
      if (data.success) {
        this.activeLinks = data.links || [];
        return this.activeLinks;
      }
      return [];
    } catch (e) {
      console.error('Failed to load share links:', e);
      return [];
    }
  }

  async generateLink(mapId, permission = 'VIEW', expirationDays = 30) {
    if (!auth.canAdmin()) {
      throw new Error('Only administrators can generate sharing links.');
    }

    const res = await fetch(CONFIG.API_BASE_URL || '/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'share:generate',
        mapId: mapId,
        permission: permission,
        expirationDays: expirationDays,
        ...auth.getAuthPayload()
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to generate link.');

    // Construct public share URL
    const origin = window.location.origin + window.location.pathname;
    const shareUrl = `${origin}?mapId=${encodeURIComponent(mapId)}&token=${encodeURIComponent(data.accessRecord.token)}&mode=${permission.toLowerCase()}`;

    return {
      record: data.accessRecord,
      shareUrl: shareUrl
    };
  }

  async revokeLink(linkId, mapId) {
    if (!auth.canAdmin()) throw new Error('Only administrators can revoke sharing links.');

    const res = await fetch(CONFIG.API_BASE_URL || '/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'share:revoke',
        linkId: linkId,
        mapId: mapId,
        ...auth.getAuthPayload()
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to revoke link.');
    return true;
  }
}

export const shareEngine = new ShareEngine();
