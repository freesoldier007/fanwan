// D1 查询小工具

// 判断 D1 异常是否为 UNIQUE 约束冲突
export function isUniqueConflict(err) {
  const m = err?.message || "";
  return m.includes("UNIQUE constraint failed") || m.includes("constraint failed");
}

export async function getBowlBySlug(db, slug) {
  return db
    .prepare("SELECT * FROM bowls WHERE slug = ?")
    .bind(slug)
    .first();
}

export function formatBowl(row) {
  if (!row) return null;
  return {
    slug: row.slug,
    title: row.title,
    want: row.want,
    reason: row.reason,
    targetYuan: row.target_cents / 100,
    currentYuan: row.current_cents / 100,
    percent: Math.min(100, Math.round((row.current_cents / row.target_cents) * 100)),
    deadline: row.deadline,
    wechatQr: row.wechat_qr,
    alipayQr: row.alipay_qr,
    usdtAddress: row.usdt_address,
    usdtQr: row.usdt_qr,
    usdtBep20Address: row.usdt_bep20_address,
    usdtBep20Qr: row.usdt_bep20_qr,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function formatDonation(row) {
  if (!row) return null;

  const isUsdt =
    row.payment_method === "usdt" ||
    row.payment_method === "usdt_bep20";

  const originalAmount =
    row.original_amount != null
      ? Number(row.original_amount)
      : isUsdt
        ? null
        : row.amount_cents / 100;

  const currency =
    row.original_currency && row.original_amount != null
      ? row.original_currency
      : isUsdt
        ? "USDT"
        : "CNY";

  const cnyEquivalentYuan =
    row.cny_equiv_cents != null
      ? Number(row.cny_equiv_cents) / 100
      : !isUsdt
        ? row.amount_cents / 100
        : null;

  return {
    id: row.id,

    nickname: row.is_anonymous
      ? "匿名耿直人"
      : row.nickname || "路过滴耿直人",

    // 兼容旧页面
    amountYuan: !isUsdt
      ? row.amount_cents / 100
      : null,

    // 原始支付金额：交易记录继续显示原币种
    originalAmount,
    currency,

    // 统一进度 / 排行榜使用人民币等值
    cnyEquivalentYuan,

    // 保留锁定汇率，方便以后管理页或审计使用
    fxRateCny:
      row.fx_rate_cny != null
        ? Number(row.fx_rate_cny)
        : null,

    message: row.message,
    paymentMethod: row.payment_method,
    txid: row.txid,
    anonymous: !!row.is_anonymous,
    status: row.status,
    createdAt: row.created_at,
  };
}

