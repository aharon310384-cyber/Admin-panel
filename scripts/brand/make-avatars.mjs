// Генератор брендовых аватаров PostmanFox для соцсетей.
// Источник: assets/brand/PostmanFox_лис.png (плоский маскот, прозрачный фон).
// Вордмарк «PostmanFox» — вектор из Space Grotesk Bold через opentype.js.
// Композиция и ресайз — sharp (lanczos3). Текст добавляется поверх лиса.
//
// Запуск: node scripts/brand/make-avatars.mjs

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const opentype = require("opentype.js");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FOX = path.join(ROOT, "assets", "brand", "PostmanFox_лис.png");
const FONT = path.join(ROOT, "assets", "brand", "fonts", "SpaceGrotesk-Bold.woff");
const OUT = path.join(ROOT, "Downloads", "PostmanFox-аватары");

const WORDMARK = "PostmanFox";
const MASTER = 1024; // размер мастер-холста

// Бренд-цвета
const GREEN = { r: 0x2d, g: 0x7c, b: 0x62, alpha: 1 }; // APP green #2d7c62 (мягче бренд-зелёного)
const WHITE = { r: 0xff, g: 0xff, b: 0xff, alpha: 1 };
const TEXT_GREEN = "#2d7c62"; // вордмарк на белом — APP-зелёный

const BACKGROUNDS = {
  white: { fill: WHITE, text: TEXT_GREEN }, // зелёный вордмарк на белом
  green: { fill: GREEN, text: "#FFFFFF" }, // белый вордмарк на зелёном APP
};

// Варианты раскладки «текст по дуге» (в координатах мастера 1024) — каждый в свою папку
const ARC_VARIANTS = {
  // пологая дуга — лис крупный по центру, текст слегка изогнут по низу (старый вариант)
  "полукруг-пологий": { foxH: 640, foxTop: 150, arcR: 410, arcCenterY: 512, arcFontSize: 92 },
  // классический полукруг — глубокая дуга (текст огибает низ), лис над ней
  "полукруг-классический": { foxH: 470, foxTop: 120, arcR: 255, arcCenterY: 650, arcFontSize: 80, arcTracking: 9 },
};

// Квадратная раскладка (общая) — прямой текст снизу
const SQUARE = { foxH: 540, foxTop: 110, textWidth: 720, textCenterY: 820 };

// Загрузка шрифта (woff поддерживается opentype.parse)
function loadFont(file) {
  const buf = fs.readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return opentype.parse(ab);
}

// SVG-слой 1024×1024 с вордмарком как вектор, центрированным по (cx, centerY)
function wordmarkSvg(font, text, targetWidth, cx, centerY, color) {
  const adv100 = font.getAdvanceWidth(text, 100);
  const fontSize = (100 * targetWidth) / adv100;
  const p0 = font.getPath(text, 0, 0, fontSize); // baseline в (0,0)
  const bb = p0.getBoundingBox();
  const w = bb.x2 - bb.x1;
  const h = bb.y2 - bb.y1;
  const tx = cx - (bb.x1 + w / 2);
  const ty = centerY - (bb.y1 + h / 2);
  const d = p0.toPathData(2);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${MASTER}" height="${MASTER}" viewBox="0 0 ${MASTER} ${MASTER}">` +
      `<path d="${d}" fill="${color}" transform="translate(${tx.toFixed(2)}, ${ty.toFixed(2)})"/>` +
      `</svg>`
  );
}

// SVG-слой 1024×1024: вордмарк ПОЛУКРУГОМ по нижней дуге (каждый глиф — вектор)
// tracking — доп. межбуквенный интервал (px вдоль дуги), чтобы буквы не скучивались
function wordmarkArcSvg(font, text, fontSize, cx, cy, R, color, tracking = 0) {
  const scale = fontSize / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(text);
  const advances = glyphs.map((g) => (g.advanceWidth || 0) * scale + tracking);
  const total = advances.reduce((a, b) => a + b, 0);
  const arc = total / R; // угловая ширина текста (рад)
  const startA = -arc / 2; // левый край дуги
  let s = 0;
  const parts = [];
  for (let i = 0; i < glyphs.length; i++) {
    const aw = advances[i];
    const a = startA + (s + aw / 2) / R; // угол от низа (0=низ, влево<0)
    const px = cx + R * Math.sin(a);
    const py = cy + R * Math.cos(a);
    const d = glyphs[i].getPath(-aw / 2, 0, fontSize).toPathData(2); // глиф центрирован по baseline
    const deg = (a * 180) / Math.PI;
    parts.push(
      `<path d="${d}" fill="${color}" transform="translate(${px.toFixed(2)},${py.toFixed(2)}) rotate(${deg.toFixed(2)})"/>`
    );
    s += aw;
  }
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${MASTER}" height="${MASTER}" viewBox="0 0 ${MASTER} ${MASTER}">${parts.join("")}</svg>`
  );
}

// Собрать мастер 1024. mode: "arc" (текст по дуге) | "square" (прямой текст)
async function buildMaster(font, L, mode, bg) {
  // фон
  const base = sharp({
    create: { width: MASTER, height: MASTER, channels: 4, background: bg.fill },
  });

  // лис: ресайз по высоте с lanczos3
  const foxBuf = await sharp(FOX)
    .resize({ height: L.foxH, kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const foxMeta = await sharp(foxBuf).metadata();
  const foxLeft = Math.round((MASTER - foxMeta.width) / 2);

  // вордмарк: прямой (square) или полукругом (arc)
  const wm =
    mode === "arc"
      ? wordmarkArcSvg(font, WORDMARK, L.arcFontSize, MASTER / 2, L.arcCenterY, L.arcR, bg.text, L.arcTracking ?? 0)
      : wordmarkSvg(font, WORDMARK, L.textWidth, MASTER / 2, L.textCenterY, bg.text);

  return base
    .composite([
      { input: foxBuf, top: L.foxTop, left: foxLeft },
      { input: wm, top: 0, left: 0 },
    ])
    .png()
    .toBuffer();
}

// Ресайз мастера в конкретный размер
async function exportSize(masterBuf, size, file) {
  await sharp(masterBuf)
    .resize(size, size, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(file);
  return `${path.relative(ROOT, file)} (${size}×${size})`;
}

// Превью кругового кропа: маска-круг + серый фон
async function circlePreview(masterBuf, size, file) {
  const circle = await sharp(masterBuf)
    .resize(size, size, { kernel: sharp.kernel.lanczos3 })
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`
        ),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();
  // на нейтральный серый фон, чтобы видно было круг
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 221, g: 221, b: 221, alpha: 1 } },
  })
    .composite([{ input: circle, top: 0, left: 0 }])
    .png()
    .toFile(file);
  return `${path.relative(ROOT, file)} (круг-превью)`;
}

async function main() {
  const font = loadFont(FONT);
  const made = [];

  // Варианты «текст по дуге» — каждый в свою папку (круглые платформы)
  for (const [vname, L] of Object.entries(ARC_VARIANTS)) {
    for (const bgKey of Object.keys(BACKGROUNDS)) {
      const bg = BACKGROUNDS[bgKey];
      const dir = path.join(OUT, vname, bgKey);
      fs.mkdirSync(dir, { recursive: true });

      const master = await buildMaster(font, L, "arc", bg);
      made.push(await exportSize(master, 512, path.join(dir, "telegram-512.png")));
      made.push(await exportSize(master, 320, path.join(dir, "instagram-320.png")));
      made.push(await exportSize(master, 640, path.join(dir, "instagram-640.png")));
      made.push(await exportSize(master, 640, path.join(dir, "whatsapp-wechat-640.png")));
      made.push(await circlePreview(master, 512, path.join(dir, "telegram-512_circle-preview.png")));
    }
  }

  // Квадратная раскладка (общая) → платформы с квадратом + мастер
  for (const bgKey of Object.keys(BACKGROUNDS)) {
    const bg = BACKGROUNDS[bgKey];
    const dir = path.join(OUT, "квадрат", bgKey);
    fs.mkdirSync(dir, { recursive: true });

    const squareMaster = await buildMaster(font, SQUARE, "square", bg);
    made.push(await exportSize(squareMaster, 800, path.join(dir, "vk-youtube-ok-800.png")));
    made.push(await exportSize(squareMaster, 1024, path.join(dir, "master-1024.png")));
  }

  console.log("Готово. Создано файлов:", made.length);
  for (const m of made) console.log("  •", m);
}

main().catch((e) => {
  console.error("Ошибка:", e);
  process.exit(1);
});
