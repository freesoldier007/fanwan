-- 饭碗儿：保存投喂的原始金额和币种
-- 人民币：original_amount=实际人民币金额，original_currency=CNY
-- USDT：original_amount=实际U数量，original_currency=USDT
-- amount_cents 保留用于现有人民币进度统计，避免破坏旧数据

ALTER TABLE donations ADD COLUMN original_amount REAL;
ALTER TABLE donations ADD COLUMN original_currency TEXT NOT NULL DEFAULT 'CNY';

-- 旧的人民币记录可以直接回填。
-- 旧 USDT 记录无法从 amount_cents 判断真实U数量，因此不伪造历史数据。
UPDATE donations
SET original_amount = amount_cents / 100.0
WHERE payment_method IN ('wechat', 'alipay');
