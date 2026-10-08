'use strict';
// deploy 步骤之一（P3-4 治理）：在产物目录 wms-app/ 写入说明，声明其为构建产物、deploy 为唯一入口。
// 放在 deploy 的 rmSync+copy 之后、clean 之前，确保 README 每次部署都重新生成、不会被清掉。
const fs = require('fs');
const path = require('path');

const dist = path.resolve(__dirname, 'dist');
const appDir = path.resolve(__dirname, '..', 'wms-app');

// 先同步 dist → wms-app（原 deploy 行为：wms-app 完全镜像 dist）
fs.rmSync(appDir, { recursive: true, force: true });
fs.cpSync(dist, appDir, { recursive: true });

const readme = `# wms-app（构建产物，请勿手改）

本目录是 **WMS 前端** 的构建产物，由 \`wms-src\` 源码经 \`npm run deploy\` 生成。

- **唯一入口**：\`cd wms-src && npm run deploy\`（build → 拷贝 dist → 清理临时文件）
- **不要直接编辑本目录文件**：任何改动请在 \`wms-src/\` 源码中进行，然后重新 deploy
- 本地预览：\`cd wms-src && npm run dev\`（默认端口 3000）
- 类型门禁：\`cd wms-src && npm run typecheck\`（\`strict\` + \`noUnused\`）
`;
fs.writeFileSync(path.join(appDir, 'README.md'), readme);
console.log('deploy: 已生成 wms-app/（含产物治理 README.md）');
