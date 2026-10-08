/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 领域拆分（P2-4b）：DBService 单体类已按域拆为 src/db/domains/* 下的域服务
// （config/catalog/inventory/orders/inbound/outbound/replenish/purchase/seed），
// 本文件仅作为 facade 聚合层，保证 15 个调用方 `DBService.method()` 零改动。
import { formatters, generateUUID } from './db/formatters';
import { DEFAULT_MODELS, DEFAULT_LINES, DEFAULT_HANDLERS, QUALITY_OPTIONS } from './db/defaults';
import { ConfigService } from './db/domains/config';
import { CatalogService } from './db/domains/catalog';
import { InventoryService } from './db/domains/inventory';
import { OrdersService } from './db/domains/orders';
import { InboundService } from './db/domains/inbound';
import { OutboundService } from './db/domains/outbound';
import { ReplenishService } from './db/domains/replenish';
import { PurchaseService } from './db/domains/purchase';
import { SeedService } from './db/domains/seed';
import type { DBServiceApi } from './db/domains/api';

// 保持原顶层导出不变（13+ 个组件直接 import，详见 docs/optimization-plan.md P2-4/P2-4b）
export { formatters, generateUUID };
export { DEFAULT_MODELS, DEFAULT_LINES, DEFAULT_HANDLERS, QUALITY_OPTIONS };

export const DBService: DBServiceApi = Object.assign(
  {},
  ConfigService,
  CatalogService,
  InventoryService,
  OrdersService,
  InboundService,
  OutboundService,
  ReplenishService,
  PurchaseService,
  SeedService,
);
