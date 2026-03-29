const https = require("https");

// Module-level cache
let cache = { venta: null, compra: null, timestamp: null, fetchedAt: 0 };
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve, reject);
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function scrapeDoларHoy() {
  const { status, body } = await fetch("https://dolarhoy.com/cotizaciondolarblue");
  if (status !== 200) throw new Error("dolarhoy returned " + status);

  // Look for sell/buy values in the page
  const buyMatch = body.match(/Compra[^$]*\$\s*([\d.,]+)/i);
  const sellMatch = body.match(/Venta[^$]*\$\s*([\d.,]+)/i);

  if (!sellMatch) throw new Error("Could not parse sell price from dolarhoy");

  const venta = parseFloat(sellMatch[1].replace(/\./g, "").replace(",", "."));
  const compra = buyMatch
    ? parseFloat(buyMatch[1].replace(/\./g, "").replace(",", "."))
    : null;

  if (isNaN(venta)) throw new Error("Parsed venta is NaN");
  return { venta, compra };
}

async function fetchBluelytics() {
  const { status, body } = await fetch("https://api.bluelytics.com.ar/v2/latest");
  if (status !== 200) throw new Error("bluelytics returned " + status);

  const data = JSON.parse(body);
  const venta = data.blue.value_sell;
  const compra = data.blue.value_buy;

  if (typeof venta !== "number") throw new Error("bluelytics: unexpected shape");
  return { venta, compra };
}

async function getRate() {
  // Try dolarhoy first, then bluelytics as fallback
  try {
    return await scrapeDoларHoy();
  } catch (err) {
    console.warn("dolarhoy failed:", err.message);
  }
  return await fetchBluelytics();
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const now = Date.now();

  // Return cached value if fresh
  if (cache.venta !== null && now - cache.fetchedAt < CACHE_TTL) {
    res.setHeader("X-Cache", "HIT");
    return res.status(200).json({
      venta: cache.venta,
      compra: cache.compra,
      timestamp: cache.timestamp,
    });
  }

  try {
    const { venta, compra } = await getRate();
    const timestamp = new Date().toISOString();

    cache = { venta, compra, timestamp, fetchedAt: now };

    res.setHeader("X-Cache", "MISS");
    return res.status(200).json({ venta, compra, timestamp });
  } catch (err) {
    console.error("dolar-blue error:", err);

    // If we have a stale cache, return it rather than an error
    if (cache.venta !== null) {
      res.setHeader("X-Cache", "STALE");
      return res.status(200).json({
        venta: cache.venta,
        compra: cache.compra,
        timestamp: cache.timestamp,
      });
    }

    return res.status(502).json({ error: "Could not fetch blue dollar rate" });
  }
};
