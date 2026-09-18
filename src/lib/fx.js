// USDT/CNY 汇率：投喂提交时获取并锁定，避免后续汇率变化改写历史进度
const FX_URL = "https://api.coinbase.com/v2/exchange-rates?currency=USDT";

export async function getUsdtCnyRate() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);

  try {
    const res = await fetch(FX_URL, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`FX HTTP ${res.status}`);

    const data = await res.json();
    const rate = Number(data?.data?.rates?.CNY);

    if (!Number.isFinite(rate) || rate < 4 || rate > 10) {
      throw new Error("FX rate invalid");
    }

    return rate;
  } finally {
    clearTimeout(timer);
  }
}
