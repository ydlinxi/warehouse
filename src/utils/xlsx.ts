/**
 * 纯前端 xlsx 导出（OOXML / SpreadsheetML，store 模式 zip，零第三方依赖）
 *
 * 与电商侧 `assets/app.js` 的实现同源；所有单元格以文本写入（inlineStr），
 * 行为与原 CSV 导出一致，避免数值 / 日期被 Excel 自动转换。
 *
 * ⚠️ 两个曾经导致 Excel 报「部分内容有问题」的坑，改动时勿回退：
 *   ① 中央目录项里「本地文件头偏移」位于 **42**（前 4 字节 38 是 external file attributes）；
 *   ② MS-DOS 时间 / 日期不能为 0（月份字段 0 非法），必须写合法时间戳。
 */

/* ---------- CRC32（zip 需要） ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

/* ---------- 工具 ---------- */
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

function concat(arrs: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrs) total += a.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const a of arrs) { out.set(a, pos); pos += a.length; }
  return out;
}

/** 当前时刻的 MS-DOS 时间 / 日期（0 会被 Excel 视为损坏） */
function dosDateTime(): { time: number; date: number } {
  const d = new Date();
  let y = d.getFullYear();
  if (y < 1980) y = 1980;
  if (y > 2107) y = 2107;
  const date = (((y - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((Math.floor(d.getSeconds() / 2)) & 0x1f);
  return { time, date };
}

interface ZipPart { name: string; data: Uint8Array }

function buildZip(parts: ZipPart[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  const dt = dosDateTime();
  let offset = 0;

  for (const p of parts) {
    const nameBytes = enc.encode(p.name);
    const data = p.data;
    const crc = crc32(data);
    const nameLen = nameBytes.length;
    const dataLen = data.length;

    // 本地文件头（30 字节）
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0, true);
    lh.setUint16(8, 0, true);
    lh.setUint16(10, dt.time, true);
    lh.setUint16(12, dt.date, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, dataLen, true);
    lh.setUint32(22, dataLen, true);
    lh.setUint16(26, nameLen, true);
    lh.setUint16(28, 0, true);
    chunks.push(new Uint8Array(lh.buffer), nameBytes, data);

    // 中央目录项（46 字节）
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0, true);
    ch.setUint16(10, 0, true);
    ch.setUint16(12, dt.time, true);
    ch.setUint16(14, dt.date, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, dataLen, true);
    ch.setUint32(24, dataLen, true);
    ch.setUint16(28, nameLen, true);
    ch.setUint16(30, 0, true);
    ch.setUint16(32, 0, true);
    ch.setUint16(34, 0, true);
    ch.setUint16(36, 0, true);
    ch.setUint32(38, 0, true);       // 38..41 = external file attributes
    ch.setUint32(42, offset, true);  // 42..45 = relative offset of local header
    central.push(new Uint8Array(ch.buffer), nameBytes);

    offset += 30 + nameLen + dataLen;
  }

  const cd = concat(central);
  const eo = new DataView(new ArrayBuffer(22));   // 中央目录结束记录
  eo.setUint32(0, 0x06054b50, true);
  eo.setUint16(4, 0, true);
  eo.setUint16(6, 0, true);
  eo.setUint16(8, parts.length, true);
  eo.setUint16(10, parts.length, true);
  eo.setUint32(12, cd.length, true);
  eo.setUint32(16, offset, true);
  eo.setUint16(20, 0, true);

  return concat([concat(chunks), cd, new Uint8Array(eo.buffer)]);
}

/** 0 → A，25 → Z，26 → AA */
function colName(n: number): string {
  let s = '';
  let x = n + 1;
  while (x > 0) { const m = (x - 1) % 26; s = String.fromCharCode(65 + m) + s; x = Math.floor((x - 1) / 26); }
  return s;
}

function xmlEscape(v: unknown): string {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** 过滤 XML 1.0 非法控制字符（否则 Excel 会判定工作簿损坏） */
function sanitize(v: unknown): string {
  // eslint-disable-next-line no-control-regex
  return String(v == null ? '' : v).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * 导出真正的 .xlsx 文件
 * @param filename 文件名（可带 .csv / .xlsx 后缀，统一替换为 .xlsx）
 * @param header   表头
 * @param rows     数据行（二维数组，单元格按文本写入）
 */
export function exportXlsx(filename: string, header: (string | number)[], rows: (string | number)[][]): void {
  exportXlsxMatrix(filename, [header, ...rows]);
}

/**
 * 导出任意矩阵（支持标题行 / 空行 / 合计行等自由排版，如月度进销存报表）
 * @param filename 文件名（可带 .csv / .xlsx 后缀，统一替换为 .xlsx）
 * @param matrix   整张表（二维数组，单元格按文本写入）
 */
export function exportXlsxMatrix(filename: string, matrix: unknown[][]): void {
  let rowsXml = '';
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r] || [];
    let cells = '';
    for (let c = 0; c < row.length; c++) {
      const ref = colName(c) + (r + 1);
      cells += `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(sanitize(row[c]))}</t></is></c>`;
    }
    rowsXml += `<row r="${r + 1}">${cells}</row>`;
  }

  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
  const sheet = head + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + rowsXml + '</sheetData></worksheet>';
  const contentTypes = head + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>';
  const rootRels = head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const workbook = head + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const wbRels = head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';

  const parts: ZipPart[] = [
    { name: '[Content_Types].xml', data: utf8(contentTypes) },
    { name: '_rels/.rels', data: utf8(rootRels) },
    { name: 'xl/workbook.xml', data: utf8(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: utf8(wbRels) },
    { name: 'xl/worksheets/sheet1.xml', data: utf8(sheet) },
  ];

  const blob = new Blob([buildZip(parts)], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/\.(csv|xlsx)$/i, '') + '.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
