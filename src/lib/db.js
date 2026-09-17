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

  // 新记录直接读取原始金额。
  // 旧人民币记录继续兼容 amount_cents。
  // 旧 USDT 因历史数据库没有真实U数量，不伪造数值。
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

  return {
    id: row.id,
    nickname: row.is_anonymous
      ? "匿名耿直人"
      : row.nickname || "路过滴耿直人",

    // 保留旧字段，避免其它页面立即失效
    amountYuan: !isUsdt ? row.amount_cents / 100 : null,

    // 新的双币种字段
    originalAmount,
    currency,

    message: row.message,
    paymentMethod: row.payment_method,
    txid: row.txid,
    anonymous: !!row.is_anonymous,
    status: row.status,
    createdAt: row.created_at,
  };
}
}
