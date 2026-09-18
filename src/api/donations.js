// 投喂 API：POST /api/donation、DELETE /api/donation/:id
import { ok, fail, ERR, readJson } from "../lib/resp.js";
import { clean, yuanToCents, isValidPaymentMethod, isValidSlug, LIMITS } from "../lib/validate.js";
import { verifyTurnstile } from "../lib/turnstile.js";
import { getIp, computeDailyKey } from "../lib/ip.js";
import { randomToken } from "../lib/slug.js";
import { getBowlBySlug } from "../lib/db.js";
import { getUsdtCnyRate } from "../lib/fx.js";

// POST /api/donation —— 投一口
// 平台不碰钱：钱是用户直接给摆碗的兄弟伙的，这里只"记一笔"，等后台审核。
export async function createDonation(request, env) {
  const ip = getIp(request);
  const body = await readJson(request);
  if (!body) return fail(ERR.VALIDATION_ERROR, "数据没传对头，再整一哈嘛。");

  const tsOk = await verifyTurnstile(
    body.turnstileToken,
    env.TURNSTILE_SECRET_KEY,
    ip
  );
  if (!tsOk) {
    return fail(ERR.TURNSTILE_FAILED, "先证明你不是机器人嘛。", 403);
  }

  if (!body.slug || !isValidSlug(body.slug)) {
    return fail(ERR.VALIDATION_ERROR, "这个饭碗儿好像没摆起。");
  }

  const bowl = await getBowlBySlug(env.DB, body.slug);
  if (!bowl) {
    return fail(ERR.NOT_FOUND, "这口饭好像没摆在这儿。", 404);
  }
  if (bowl.status !== "active") {
    return fail(ERR.CONFLICT, "这个饭碗儿已经收摊了，投不得喽。", 409);
  }

  const paymentMethod = body.paymentMethod;
  if (!isValidPaymentMethod(paymentMethod)) {
    return fail(ERR.VALIDATION_ERROR, "啷个投的选一个嘛。");
  }

  // 服务端再次确认摆碗者确实配置了这个收款方式，
  // 不只依赖前端按钮置灰。
  const paymentConfigured =
    paymentMethod === "wechat"
      ? !!bowl.wechat_qr
      : paymentMethod === "alipay"
        ? !!bowl.alipay_qr
        : paymentMethod === "usdt"
          ? !!(bowl.usdt_qr || bowl.usdt_address)
          : !!(bowl.usdt_bep20_qr || bowl.usdt_bep20_address);

  if (!paymentConfigured) {
    return fail(ERR.VALIDATION_ERROR, "摆碗的莫得留这个收款方式。");
  }

  const rawAmount = Number(body.amount);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0 || rawAmount > 1000) {
    return fail(ERR.VALIDATION_ERROR, "你这个金额有点不对头哈。");
  }

  const isUsdt =
    paymentMethod === "usdt" ||
    paymentMethod === "usdt_bep20";

  const originalAmount = rawAmount;
  const originalCurrency = isUsdt ? "USDT" : "CNY";

  // 旧字段继续保留，避免其它旧代码失效。
  // 真正的统一进度以后只读取 cny_equiv_cents。
  const amountCents = isUsdt ? 1 : yuanToCents(rawAmount);

  if (amountCents === null) {
    return fail(ERR.VALIDATION_ERROR, "你这个金额有点不对头哈。");
  }

  let fxRateCny = 1;
  let cnyEquivalentCents = amountCents;

  if (isUsdt) {
    try {
      fxRateCny = await getUsdtCnyRate();
      cnyEquivalentCents = Math.round(
        originalAmount * fxRateCny * 100
      );
    } catch {
      return fail(
        ERR.SERVER_ERROR,
        "USDT 汇率暂时没取到，这一口先莫报，等哈再试。",
        503
      );
    }

    if (
      !Number.isInteger(cnyEquivalentCents) ||
      cnyEquivalentCents <= 0
    ) {
      return fail(ERR.SERVER_ERROR, "USDT 折算金额没算对，再试一哈。", 503);
    }
  }

  const message = clean(body.message, LIMITS.messageMax);
  const nickname = clean(body.nickname, LIMITS.nicknameMax);
  const txid = clean(body.txid, LIMITS.txidMax);
  const isAnonymous = body.isAnonymous ? 1 : 0;

  const { key: ipHash } = await computeDailyKey(
    ip,
    env.SERVER_SECRET
  );

  const deleteToken = randomToken();

  const res = await env.DB.prepare(
    `INSERT INTO donations
       (
         bowl_id,
         nickname,
         amount_cents,
         original_amount,
         original_currency,
         fx_rate_cny,
         cny_equiv_cents,
         message,
         payment_method,
         txid,
         is_anonymous,
         status,
         ip_hash,
         delete_token
       )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  )
    .bind(
      bowl.id,
      nickname,
      amountCents,
      originalAmount,
      originalCurrency,
      fxRateCny,
      cnyEquivalentCents,
      message,
      paymentMethod,
      txid,
      isAnonymous,
      ipHash.slice(0, 32),
      deleteToken
    )
    .run();

  return ok(
    {
      id: res.meta.last_row_id,
      deleteToken,
      originalAmount,
      originalCurrency,
    },
    201
  );
}

// DELETE /api/donation/:id?token=xxx
export async function deleteDonation(request, env, id) {
  const token =
    new URL(request.url).searchParams.get("token") || "";

  const row = await env.DB
    .prepare("SELECT * FROM donations WHERE id = ?")
    .bind(id)
    .first();

  if (!row) {
    return fail(ERR.NOT_FOUND, "这笔投喂没找到。", 404);
  }

  if (row.status !== "pending") {
    return fail(
      ERR.CONFLICT,
      "这口饭已经被端走了，撤不脱喽。",
      409
    );
  }

  if (!token || token !== row.delete_token) {
    return fail(
      ERR.UNAUTHORIZED,
      "这不是你投的那口。",
      401
    );
  }

  await env.DB
    .prepare(
      "DELETE FROM donations WHERE id = ? AND status = 'pending'"
    )
    .bind(id)
    .run();

  return ok({ id: Number(id) });
}
