-- Payment Gateway Migration (idempotent — safe to re-run)
-- Run this in Supabase SQL Editor

-- 1. Add payment_model column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS payment_model TEXT DEFAULT 'utr';

-- 2. Create payment_orders table
CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES event_teams(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  cashfree_order_id TEXT UNIQUE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed', 'expired')),
  payment_method TEXT,
  cashfree_payment_id TEXT,
  failure_reason TEXT,
  member_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_payment_orders_team_id ON payment_orders(team_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_cashfree_order_id ON payment_orders(cashfree_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);

-- 4. Create payment_webhook_events table
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. RLS for payment_orders
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leaders can view own payment orders" ON payment_orders;
DROP POLICY IF EXISTS "Leaders can create payment orders" ON payment_orders;
DROP POLICY IF EXISTS "Leaders can update own payment orders" ON payment_orders;
DROP POLICY IF EXISTS "Admins can view all payment orders" ON payment_orders;

CREATE POLICY "Leaders can view own payment orders" ON payment_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Leaders can create payment orders" ON payment_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Leaders can update own payment orders" ON payment_orders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payment orders" ON payment_orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. RLS for payment_webhook_events
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages webhook events" ON payment_webhook_events;

CREATE POLICY "Service role manages webhook events" ON payment_webhook_events
  FOR ALL USING (true);

-- 7. updated_at trigger
CREATE OR REPLACE FUNCTION update_payment_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_payment_orders_updated_at ON payment_orders;

CREATE TRIGGER trigger_payment_orders_updated_at
  BEFORE UPDATE ON payment_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_orders_updated_at();
