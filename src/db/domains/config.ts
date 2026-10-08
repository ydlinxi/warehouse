/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import type { DBServiceApi } from './api';
import type { WarehouseConfig } from '../../types';
import { DEFAULT_LINES } from '../defaults';
import { DEFAULT_HANDLERS } from '../defaults';
import { KEYS } from '../defaults';

export const ConfigService = {

  // Load config with multi-zone support and auto-migration
    getWarehouseConfig(this: DBServiceApi): WarehouseConfig {
    const default_config: WarehouseConfig = {
      zones: [
        { code: 'A', rows: 70, cols: 20 },
        { code: 'B', rows: 70, cols: 20 }
      ]
    };
    const saved = localStorage.getItem(KEYS.WAREHOUSE_CONFIG);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Check if old format where zones is just a string array
        if (parsed.zones && Array.isArray(parsed.zones) && (parsed.zones.length === 0 || typeof parsed.zones[0] === 'string')) {
          const migratedZones = parsed.zones.map((zCode: any) => ({
            code: String(zCode),
            rows: parsed.rows || 70,
            cols: parsed.cols || 20
          }));
          const migrated: WarehouseConfig = { zones: migratedZones };
          localStorage.setItem(KEYS.WAREHOUSE_CONFIG, JSON.stringify(migrated));
          return migrated;
        }
        return parsed;
      } catch (e) {
        return default_config;
      }
    }
    localStorage.setItem(KEYS.WAREHOUSE_CONFIG, JSON.stringify(default_config));
    return default_config;
  },


    saveWarehouseConfig(this: DBServiceApi, config: WarehouseConfig) {
    localStorage.setItem(KEYS.WAREHOUSE_CONFIG, JSON.stringify(config));
  },


  // Load Lines
    getLines(this: DBServiceApi): string[] {
    const saved = localStorage.getItem(KEYS.LINES);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    localStorage.setItem(KEYS.LINES, JSON.stringify(DEFAULT_LINES));
    return DEFAULT_LINES;
  },


    saveLines(this: DBServiceApi, lines: string[]) {
    localStorage.setItem(KEYS.LINES, JSON.stringify(lines));
  },


  // Load Handlers
    getHandlers(this: DBServiceApi): string[] {
    const saved = localStorage.getItem(KEYS.HANDLERS);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    localStorage.setItem(KEYS.HANDLERS, JSON.stringify(DEFAULT_HANDLERS));
    return DEFAULT_HANDLERS;
  },


    saveHandlers(this: DBServiceApi, handlers: string[]) {
    localStorage.setItem(KEYS.HANDLERS, JSON.stringify(handlers));
  },


  // Clear data / Reset defaults
    resetToDefault(this: DBServiceApi) {
    // 清空全部业务与主数据 KEY（含供应商/SKU/补货计划/采购单/待出库/采购计划行），
    // 避免"恢复默认演示数据"后出现半新半旧的残留状态
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    this.initDatabaseIfEmpty();
  },


    resetDatabase(this: DBServiceApi) {
    this.resetToDefault();
  }
};
