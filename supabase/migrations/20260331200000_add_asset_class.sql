-- Add asset_class column to signals, positions, and watchlist tables
-- Supported values: equity, crypto, forex, commodity, bond, alternative, reit, etf

ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS asset_class TEXT NOT NULL DEFAULT 'equity';

ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS asset_class TEXT NOT NULL DEFAULT 'equity';

ALTER TABLE public.watchlist
  ADD COLUMN IF NOT EXISTS asset_class TEXT NOT NULL DEFAULT 'equity';

-- Add useful indexes for filtering by asset class
CREATE INDEX IF NOT EXISTS idx_signals_asset_class ON public.signals(asset_class);
CREATE INDEX IF NOT EXISTS idx_positions_asset_class ON public.positions(asset_class);
CREATE INDEX IF NOT EXISTS idx_watchlist_asset_class ON public.watchlist(asset_class);
