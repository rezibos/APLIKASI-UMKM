-- Tabel Admin Users untuk sistem login/register
-- Jalankan ini di SQL Editor Supabase

-- Drop table jika sudah ada (untuk fresh install)
DROP TABLE IF EXISTS admin_users CASCADE;

CREATE TABLE admin_users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'kasir' CHECK (role IN ('super_admin', 'kasir', 'koki')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (opsional, bisa diaktifkan jika perlu)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policy untuk CRUD
CREATE POLICY "Anyone can read admin_users"
    ON admin_users FOR SELECT
    USING (true);

CREATE POLICY "Anyone can insert admin_users"
    ON admin_users FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Anyone can update admin_users"
    ON admin_users FOR UPDATE
    USING (true);

CREATE POLICY "Anyone can delete admin_users"
    ON admin_users FOR DELETE
    USING (true);

-- Index untuk optimasi email
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- Insert admin default (optional - ganti password sesuai kebutuhan)
-- Password default: admin123
INSERT INTO admin_users (name, email, password, role)
VALUES
    ('Super Admin', 'admin@kopisearah.com', 'admin123', 'super_admin')
ON CONFLICT (email) DO NOTHING;

-- Contoh user lain (opsional)
INSERT INTO admin_users (name, email, password, role)
VALUES
    ('Kasir Utama', 'kasir@kopisearah.com', 'kasir123', 'kasir'),
    ('Koki Utama', 'koki@kopisearah.com', 'koki123', 'koki')
ON CONFLICT (email) DO NOTHING;