-- 饭碗儿：锁定每笔投喂提交时的人民币等值
ALTER TABLE donations ADD COLUMN fx_rate_cny REAL;
ALTER TABLE donations ADD COLUMN cny_equiv_cents INTEGER;

-- 历史人民币可以可靠回填；历史 USDT 不使用今天汇率伪造
UPDATE donations
SET fx_rate_cny = 1,
    cny_equiv_cents = amount_cents
WHERE payment_method IN ('wechat', 'alipay')
  AND cny_equiv_cents IS NULL;
