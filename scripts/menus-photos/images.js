// Outils d'image de la chaîne de photos : dimensions lues dans l'en-tête (PNG, WebP, JPEG), conversion
// WebP 640x640 avec sharp, empreintes perceptuelles aHash et dHash 64 bits (16 caractères hexadécimaux).
'use strict';
/* global Buffer */

const crypto = require('crypto');

/** sharp s'il est installé (npm i --no-save sharp), sinon null. */
function chargerSharp() {
  try {
    return require('sharp');
  } catch (_e) {
    return null;
  }
}

/** { format, largeur, hauteur } lus dans l'en-tête, ou null si le fichier n'est pas reconnu. */
function dimensions(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 30) return null;
  // PNG
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.toString('ascii', 12, 16) === 'IHDR')
    return { format: 'png', largeur: buf.readUInt32BE(16), hauteur: buf.readUInt32BE(20) };
  // WebP
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const bloc = buf.toString('ascii', 12, 16);
    if (bloc === 'VP8X')
      return {
        format: 'webp',
        largeur: 1 + buf.readUIntLE(24, 3),
        hauteur: 1 + buf.readUIntLE(27, 3),
      };
    if (bloc === 'VP8 ' && buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a)
      return {
        format: 'webp',
        largeur: buf.readUInt16LE(26) & 0x3fff,
        hauteur: buf.readUInt16LE(28) & 0x3fff,
      };
    if (bloc === 'VP8L' && buf[20] === 0x2f) {
      const b = buf.readUInt32LE(21);
      return { format: 'webp', largeur: 1 + (b & 0x3fff), hauteur: 1 + ((b >> 14) & 0x3fff) };
    }
    return null;
  }
  // JPEG : premier segment SOFn
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const m = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
        return {
          format: 'jpeg',
          largeur: buf.readUInt16BE(i + 7),
          hauteur: buf.readUInt16BE(i + 5),
        };
      i += 2 + len;
    }
  }
  return null;
}

const sha1 = (buf) => crypto.createHash('sha1').update(buf).digest('hex');

/* ------------------------------------------------------------------ empreintes */

/** Pixels gris (Uint8Array w*h) par moyenne de boîtes, depuis un tampon RGBA ou gris. */
function reduire(data, W, H, canaux, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * H) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * H) / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * W) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * W) / w));
      let s = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const p = (yy * W + xx) * canaux;
          s += canaux >= 3 ? 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2] : data[p];
          n++;
        }
      out[y * w + x] = Math.round(s / n);
    }
  }
  return out;
}

function bitsVersHex(bits) {
  let hex = '';
  for (let i = 0; i < 64; i += 4)
    hex += ((bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3]).toString(16);
  return hex;
}

/** aHash : 8x8 gris, bit = pixel au-dessus de la moyenne. */
function aHashDe(gris8x8) {
  let m = 0;
  for (const v of gris8x8) m += v;
  m /= 64;
  return bitsVersHex(Array.from(gris8x8, (v) => (v > m ? 1 : 0)));
}

/** dHash : 9x8 gris, bit = pixel plus clair que son voisin de droite. */
function dHashDe(gris9x8) {
  const bits = [];
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) bits.push(gris9x8[y * 9 + x] > gris9x8[y * 9 + x + 1] ? 1 : 0);
  return bitsVersHex(bits);
}

/** { ahash, dhash } d'un fichier image. sharp pour tout format ; sans sharp, PNG seulement (pngjs). */
async function empreintes(buf, sharp = chargerSharp()) {
  if (sharp) {
    const g8 = await sharp(buf).greyscale().resize(8, 8, { fit: 'fill' }).raw().toBuffer();
    const g9 = await sharp(buf).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
    return { ahash: aHashDe(g8), dhash: dHashDe(g9) };
  }
  const d = dimensions(buf);
  if (!d || d.format !== 'png') return null;
  const { PNG } = require('pngjs');
  const png = PNG.sync.read(buf);
  return {
    ahash: aHashDe(reduire(png.data, png.width, png.height, 4, 8, 8)),
    dhash: dHashDe(reduire(png.data, png.width, png.height, 4, 9, 8)),
  };
}

function popcount32(v) {
  v -= (v >>> 1) & 0x55555555;
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** Empreinte hexadécimale -> [haut, bas] (deux entiers 32 bits), pour comparer vite. */
const versMots = (hex) => [
  parseInt(hex.slice(0, 8), 16) >>> 0,
  parseInt(hex.slice(8, 16), 16) >>> 0,
];

/** Distance de Hamming entre deux empreintes ([haut, bas] ou hexadécimal). */
function hamming(a, b) {
  const x = typeof a === 'string' ? versMots(a) : a;
  const y = typeof b === 'string' ? versMots(b) : b;
  return popcount32((x[0] ^ y[0]) >>> 0) + popcount32((x[1] ^ y[1]) >>> 0);
}

/** Image de l'API (PNG, WebP ou JPEG 1024) -> WebP 640x640 qualité 80. Exige sharp. */
async function versWebp640(buf, sharp, qualite = 80) {
  return sharp(buf)
    .resize(640, 640, { fit: 'cover' })
    .webp({ quality: qualite, effort: 5 })
    .toBuffer();
}

module.exports = {
  chargerSharp,
  dimensions,
  sha1,
  empreintes,
  hamming,
  versMots,
  versWebp640,
  aHashDe,
  dHashDe,
  reduire,
};
