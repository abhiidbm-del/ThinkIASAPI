const DEVANAGARI = /[\u0900-\u097F]/;

let hbPromise;

function loadHarfBuzz() {
  if (!hbPromise) hbPromise = import('harfbuzzjs');
  return hbPromise;
}

async function attachDevanagariShaping(fontkitFont, fontBytes) {
  const hb = await loadHarfBuzz();
  const bytes = fontBytes instanceof Uint8Array ? fontBytes : new Uint8Array(fontBytes);
  const blob = new hb.Blob(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const face = new hb.Face(blob);
  const hbFont = new hb.Font(face);
  hbFont.setScale(fontkitFont.unitsPerEm || 1000, fontkitFont.unitsPerEm || 1000);
  const originalLayout = fontkitFont.layout.bind(fontkitFont);

  fontkitFont.layout = (text, features) => {
    if (!text || !DEVANAGARI.test(text)) return originalLayout(text, features);
    const buffer = new hb.Buffer();
    buffer.addText(text);
    buffer.guessSegmentProperties();
    hb.shape(hbFont, buffer);
    const infos = buffer.getGlyphInfos();
    const shapedPositions = buffer.getGlyphPositions();
    const glyphs = [];
    const positions = [];
    let advanceWidth = 0;
    for (let i = 0; i < infos.length; i += 1) {
      glyphs.push(fontkitFont.getGlyph(infos[i].codepoint));
      const position = shapedPositions[i];
      positions.push({
        xAdvance: position.xAdvance,
        yAdvance: position.yAdvance,
        xOffset: position.xOffset,
        yOffset: position.yOffset
      });
      advanceWidth += position.xAdvance;
    }
    if (typeof buffer.destroy === 'function') buffer.destroy();
    return { glyphs, positions, advanceWidth };
  };
}

module.exports = { attachDevanagariShaping };
