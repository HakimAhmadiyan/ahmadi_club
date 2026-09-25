'use strict';

import { Storage } from './storage.js';

/**
 * Tracks time this browser has observed a controller connected.
 * It deliberately does NOT claim to read a factory/lifetime usage counter from the DS4.
 */
export class UsageTracker {
  constructor() {
    this.key = null;
    this.startMs = 0;
    this.baseSeconds = 0;
    this.timer = null;
    this.lastPersistMs = 0;
  }

  async start(controllerInstance, device) {
    this.stop();
    let identity = null;
    try { identity = await controllerInstance?.getSerialNumber?.(); } catch (_) {}
    identity = identity || device?.serialNumber || `${device?.vendorId || 0}:${device?.productId || 0}`;
    this.key = `ahmadi_usage_${String(identity).replace(/[^a-zA-Z0-9:_-]/g, '_')}`;
    this.baseSeconds = Math.max(0, Storage.getNumber(this.key, 0));
    this.startMs = Date.now();
    this.lastPersistMs = this.startMs;
    this._render();
    this.timer = setInterval(() => this._tick(), 1000);
  }

  stop() {
    if (!this.key || !this.startMs) { this._clear(); return; }
    this._persist();
    this._clear();
  }

  _clear() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.key = null;
    this.startMs = 0;
    this.baseSeconds = 0;
    this.lastPersistMs = 0;
  }

  _sessionSeconds() {
    return this.startMs ? Math.max(0, Math.floor((Date.now() - this.startMs) / 1000)) : 0;
  }

  _persist() {
    if (!this.key || !this.startMs) return;
    const total = this.baseSeconds + this._sessionSeconds();
    Storage.setNumber(this.key, total);
    this.baseSeconds = total;
    this.startMs = Date.now();
    this.lastPersistMs = this.startMs;
  }

  _tick() {
    if (!this.startMs) return;
    this._render();
    if (Date.now() - this.lastPersistMs >= 10000) this._persist();
  }

  _render() {
    const session = this._sessionSeconds();
    const total = this.baseSeconds + session;
    const sessionEl = document.getElementById('usage-session');
    const totalEl = document.getElementById('usage-total');
    if (sessionEl) sessionEl.textContent = this._format(session);
    if (totalEl) totalEl.textContent = this._format(total);
  }

  _format(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    const days = Math.floor(seconds / 86400);
    seconds %= 86400;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    return days ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
  }

  persistBeforeUnload() { this._persist(); }
}
