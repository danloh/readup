const fs = require('fs');
const path = require('path');
const https = require('https');

const keysFile = path.join(__dirname, 'translation_keys.txt');
const localesDir = path.join(__dirname, '..', 'public', 'locales');

if (!fs.existsSync(keysFile)) {
  console.error('Keys file not found:', keysFile);
  process.exit(1);
}
const keys = fs.readFileSync(keysFile, 'utf8').split(/\r?\n/).filter(Boolean);
console.log('Keys count:', keys.length);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return {};
  }
}
function writeFileAtomic(file, content) {
  fs.writeFileSync(file + '.tmp', content, 'utf8');
  fs.renameSync(file + '.tmp', file);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Map locale folder -> google translate target code
function mapLocaleToTL(locale) {
  // common conversions
  if (locale === 'en') return 'en';
  if (locale === 'zh-CN') return 'zh-CN';
  if (locale === 'zh-TW') return 'zh-TW';
  // google supports e.g. 'pt', 'ru', 'ja', etc.
  // use base code before any dash
  return locale.split('-')[0];
}

async function googleTranslate(text, targetLang) {
  return new Promise((resolve) => {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=en&tl=' + encodeURIComponent(targetLang) + '&q=' + encodeURIComponent(text);
    https
      .get(url, { headers: { 'User-Agent': 'readup-i18n/1.0' } }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode !== 200) return resolve(null);
          try {
            const data = JSON.parse(body);
            if (!Array.isArray(data) || !Array.isArray(data[0])) return resolve(null);
            return resolve(data[0].map((item) => item[0]).join(''));
          } catch (e) {
            return resolve(null);
          }
        });
      })
      .on('error', () => resolve(null));
  });
}

(async () => {
  const locales = fs.readdirSync(localesDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d=>d.name).filter(n=>n !== '.well-known');
  const enPath = path.join(localesDir, 'en', 'translation.json');
  const enTrans = fs.existsSync(enPath) ? readJson(enPath) : {};

  const summary = {};

  for (const locale of locales) {
    const filePath = path.join(localesDir, locale, 'translation.json');
    const existing = fs.existsSync(filePath) ? readJson(filePath) : {};
    const targetLang = mapLocaleToTL(locale);
    const newObj = {};
    let translatedCount = 0;
    let todoCount = 0;

    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(existing, key)) {
        newObj[key] = existing[key];
        continue;
      }
      const sourceText = enTrans[key] || key;
      if (locale === 'en') {
        newObj[key] = sourceText;
        continue;
      }
      // try to translate
      const translated = await googleTranslate(sourceText, targetLang);
      if (translated && translated.trim().length) {
        newObj[key] = translated;
        translatedCount++;
      } else {
        newObj[key] = 'TODO: ' + sourceText;
        todoCount++;
      }
      // small delay to avoid hammering
      await sleep(120);
    }

    // collect redundant keys
    const redundant = {};
    for (const k of Object.keys(existing)) {
      if (!keys.includes(k)) redundant[k] = existing[k];
    }

    // write JSON with main keys sorted, then __redundant at the end
    const orderedKeys = Object.keys(newObj).sort((a,b)=> a.localeCompare(b));
    let out = '{\n';
    for (const k of orderedKeys) {
      const v = JSON.stringify(newObj[k]);
      out += `  ${JSON.stringify(k)}: ${v},\n`;
    }
    // add redundant block
    out += `  "__redundant__": ${JSON.stringify(redundant, null, 2).replace(/\n/g,'\n  ')}\n`;
    out += '}\n';

    writeFileAtomic(filePath, out);
    summary[locale] = { translated: translatedCount, todo: todoCount, redundant: Object.keys(redundant).length };
    console.log(`Wrote ${filePath} (translated:${translatedCount} todo:${todoCount} redundant:${Object.keys(redundant).length})`);
  }

  console.log('Summary:', summary);
})();
