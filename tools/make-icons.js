// Eklenti simgesini üretir: düz (flat), simetrik, önden görünüm resmi kurum binası.
// Bağımlılık yok; PNG kodlayıcı burada, saf Node ile yazılmıştır.
// Kullanım:  node tools/make-icons.js
'use strict';

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// --- Renk paleti (mat, yumuşak) -------------------------------------------
const BG      = [0x1c, 0x21, 0x26, 255]; // koyu antrasit
const BLUEGR  = [0x8c, 0xa0, 0xb3, 255]; // pastel mavi-gri
const LIGHT   = [0xe4, 0xe9, 0xed, 255]; // çok açık gri
const MIDGR   = [0xc7, 0xcf, 0xd6, 255]; // gri

// --- 128 birimlik tasarım ızgarası ----------------------------------------
const U = 128;

const rect = (x0, y0, x1, y1, c) => ({ k: 'rect', x0, y0, x1, y1, c });
const tri  = (ax, ay, bx, by, cx, cy, c) => ({ k: 'tri', ax, ay, bx, by, cx, cy, c });
const arch = (x0, x1, yTop, yBottom, c) => ({ k: 'arch', x0, x1, yTop, yBottom, c });

const SHAPES = [
  // Alınlık: dış mavi-gri kenar + iç açık gri
  tri(64, 8, 8, 40, 120, 40, BLUEGR),
  tri(64, 17, 19, 37, 109, 37, LIGHT),

  // Üst kısmı çerçeveleyen iki kalın yatay şerit
  rect(14, 42, 114, 50, LIGHT),
  rect(14, 53, 114, 61, MIDGR),

  // Dört kalın dikdörtgen sütun (aralarında koyu arka plan görünür)
  rect(18, 63, 32, 102, BLUEGR),
  rect(38, 63, 52, 102, BLUEGR),
  rect(76, 63, 90, 102, BLUEGR),
  rect(96, 63, 110, 102, BLUEGR),

  // Ortada açık gri duvar bloğu ve içine oyulmuş kemerli kapı
  rect(51, 63, 77, 102, LIGHT),
  arch(55, 73, 71, 102, BG),

  // Kaide ve en altta hafifçe dışarı taşan ikinci taban
  rect(14, 102, 114, 112, LIGHT),
  rect(8, 112, 120, 119, MIDGR)
];

// --- Rasterleştirme --------------------------------------------------------
function inside(shape, x, y) {
  switch (shape.k) {
    case 'rect':
      return x >= shape.x0 && x < shape.x1 && y >= shape.y0 && y < shape.y1;

    case 'tri': {
      const { ax, ay, bx, by, cx, cy } = shape;
      const s = (px, py, qx, qy, rx, ry) =>
        (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
      const d1 = s(x, y, ax, ay, bx, by);
      const d2 = s(x, y, bx, by, cx, cy);
      const d3 = s(x, y, cx, cy, ax, ay);
      const neg = d1 < 0 || d2 < 0 || d3 < 0;
      const pos = d1 > 0 || d2 > 0 || d3 > 0;
      return !(neg && pos);
    }

    case 'arch': {
      const { x0, x1, yTop, yBottom } = shape;
      if (x < x0 || x >= x1) return false;
      const r = (x1 - x0) / 2;
      const cxx = (x0 + x1) / 2;
      const cyy = yTop + r;            // yarım daire merkezi
      if (y >= cyy) return y < yBottom;
      const dx = x - cxx;
      const dy = y - cyy;
      return dx * dx + dy * dy <= r * r;
    }
  }
  return false;
}

function colorAt(x, y) {
  let c = BG;
  for (const s of SHAPES) if (inside(s, x, y)) c = s.c;
  return c;
}

// SS kat süper örnekleme ile kutu filtreli küçültme (küçük boyutta netlik için)
function render(size, ss) {
  const px = new Uint8Array(size * size * 4);
  const step = U / (size * ss);

  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let r = 0, g = 0, b = 0, a = 0;

      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const ux = ((pxi * ss + sx) + 0.5) * step;
          const uy = ((py * ss + sy) + 0.5) * step;
          const c = colorAt(ux, uy);
          r += c[0]; g += c[1]; b += c[2]; a += c[3];
        }
      }

      const n = ss * ss;
      const o = (py * size + pxi) * 4;
      px[o]     = Math.round(r / n);
      px[o + 1] = Math.round(g / n);
      px[o + 2] = Math.round(b / n);
      px[o + 3] = Math.round(a / n);
    }
  }
  return px;
}

// --- Asgari PNG kodlayıcı --------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(px, size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    Buffer.from(px.buffer, y * size * 4, size * 4)
      .copy(raw, y * (size * 4 + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// --- Çıktı -----------------------------------------------------------------
const outDir = path.join(__dirname, '..');
for (const size of [16, 32, 48, 128]) {
  const ss = size <= 32 ? 8 : 4;
  const file = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(file, encodePng(render(size, ss), size));
  console.log('yazıldı:', path.basename(file));
}
