ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "modulePermissions" TEXT[] DEFAULT ARRAY['dashboard', 'housekeeping', 'maintenance', 'guests', 'inventory', 'reports', 'messaging', 'admin'];
