-- User Profiles Migration
-- Stores user nicknames for @mention system

-- User Profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    email TEXT NOT NULL,
    nickname TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast nickname lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_nickname ON user_profiles(nickname);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read all profiles (for @mention lookups) but only update their own
CREATE POLICY "Allow read all profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Allow users to update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Allow users to insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Pre-populate known users
INSERT INTO user_profiles (user_id, email, nickname)
SELECT id, email, 'sincap'
FROM auth.users
WHERE email = 'sinemarik@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET nickname = 'sincap';

INSERT INTO user_profiles (user_id, email, nickname)
SELECT id, email, 'mirket'
FROM auth.users
WHERE email = 'zippro@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET nickname = 'mirket';
