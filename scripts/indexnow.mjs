import { readFileSync } from 'node:fs';

const HOST = 'conforva.com';
const KEY = process.env.INDEXNOW_KEY || 'fdb8d04448f64d7798a51124723f94ed';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const SITEMAP_PATH = new URL('../static/sitemap.xml', import.meta.url);

async function main() {
  try {
    const xml = readFileSync(SITEMAP_PATH, 'utf8');
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((match) => match[1].trim())
      .filter(Boolean);

    if (!urls.length) throw new Error('No URLs found in sitemap');

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: HOST,
        key: KEY,
        keyLocation: KEY_LOCATION,
        urlList: urls
      })
    });

    const body = await response.text();
    if (!response.ok) {
      throw new Error(`IndexNow returned ${response.status}: ${body.slice(0, 500)}`);
    }

    console.log(`IndexNow: submitted ${urls.length} Conforva URLs (${response.status}).`);
  } catch (error) {
    console.warn(`IndexNow notification skipped: ${error instanceof Error ? error.message : String(error)}`);
  }
}

await main();
