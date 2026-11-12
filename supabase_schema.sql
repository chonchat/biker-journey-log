-- ============================================================
-- Biker Journey Log - Supabase Database Schema & RLS Policies
-- นำโค้ดนี้ไปรันใน Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. ตาราง profiles (เชื่อมกับ auth.users พร้อม bio สังเขป และ social_links แนบลิงก์)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  bike_model TEXT,
  avatar_url TEXT,
  bio TEXT,
  social_links JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '[]'::jsonb;

-- 2. ตาราง trips
CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ตาราง checkpoints
CREATE TABLE IF NOT EXISTS public.checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ตาราง trip_photos
CREATE TABLE IF NOT EXISTS public.trip_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ตาราง trip_reactions (สำหรับกด Like / Dislike)
CREATE TABLE IF NOT EXISTS public.trip_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'dislike')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (trip_id, user_id)
);

-- 6. ตาราง trip_comments (สำหรับคอมเมนต์ทริปและตอบกลับคอมเมนต์)
CREATE TABLE IF NOT EXISTS public.trip_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.trip_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ตาราง notifications (ระบบแจ้งเตือนเจ้าของทริปเมื่อมีคนคอมเมนต์)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.trip_comments(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'comment',
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- เปิดใช้งาน Row Level Security (RLS) ทุกตาราง
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies
-- ============================================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Public can view profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policies สำหรับ trips
DROP POLICY IF EXISTS "Users can view own trips" ON public.trips;
DROP POLICY IF EXISTS "Public can view trips" ON public.trips;
DROP POLICY IF EXISTS "Users can insert own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can update own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can delete own trips" ON public.trips;

CREATE POLICY "Public can view trips"
  ON public.trips FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own trips"
  ON public.trips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trips"
  ON public.trips FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own trips"
  ON public.trips FOR DELETE
  USING (auth.uid() = user_id);

-- Policies สำหรับ checkpoints
DROP POLICY IF EXISTS "Users can manage checkpoints of own trips" ON public.checkpoints;
DROP POLICY IF EXISTS "Public can view checkpoints" ON public.checkpoints;

CREATE POLICY "Public can view checkpoints"
  ON public.checkpoints FOR SELECT
  USING (true);

CREATE POLICY "Users can manage checkpoints of own trips"
  ON public.checkpoints FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = checkpoints.trip_id
      AND trips.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = checkpoints.trip_id
      AND trips.user_id = auth.uid()
    )
  );

-- Policies สำหรับ trip_photos
DROP POLICY IF EXISTS "Users can manage photos of own trips" ON public.trip_photos;
DROP POLICY IF EXISTS "Public can view trip photos" ON public.trip_photos;

CREATE POLICY "Public can view trip photos"
  ON public.trip_photos FOR SELECT
  USING (true);

CREATE POLICY "Users can manage photos of own trips"
  ON public.trip_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_photos.trip_id
      AND trips.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_photos.trip_id
      AND trips.user_id = auth.uid()
    )
  );

-- Policies สำหรับ trip_reactions (Like / Dislike)
DROP POLICY IF EXISTS "Public can view reactions" ON public.trip_reactions;
DROP POLICY IF EXISTS "Authenticated users can manage own reactions" ON public.trip_reactions;

CREATE POLICY "Public can view reactions"
  ON public.trip_reactions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage own reactions"
  ON public.trip_reactions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policies สำหรับ trip_comments (Comments)
DROP POLICY IF EXISTS "Public can view comments" ON public.trip_comments;
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.trip_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.trip_comments;

CREATE POLICY "Public can view comments"
  ON public.trip_comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert comments"
  ON public.trip_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON public.trip_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies สำหรับ notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger อัตโนมัติ: แจ้งเตือนเจ้าของทริปเมื่อมีคนคอมเมนต์
CREATE OR REPLACE FUNCTION public.handle_trip_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  trip_owner_id UUID;
  trip_title_text TEXT;
  commenter_name TEXT;
BEGIN
  SELECT user_id, title INTO trip_owner_id, trip_title_text
  FROM public.trips
  WHERE id = NEW.trip_id;

  IF trip_owner_id IS NOT NULL AND trip_owner_id <> NEW.user_id THEN
    SELECT username INTO commenter_name
    FROM public.profiles
    WHERE id = NEW.user_id;

    IF commenter_name IS NULL OR commenter_name = '' THEN
      commenter_name := 'เพื่อนนักบิด';
    END IF;

    INSERT INTO public.notifications (user_id, actor_id, trip_id, comment_id, type, message)
    VALUES (
      trip_owner_id,
      NEW.user_id,
      NEW.trip_id,
      NEW.id,
      'comment',
      commenter_name || ' ได้แสดงความคิดเห็นในทริป "' || trip_title_text || '": ' || LEFT(NEW.content, 80)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_on_comment ON public.trip_comments;
CREATE TRIGGER trg_notify_on_comment
  AFTER INSERT ON public.trip_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_trip_comment_notification();

-- ============================================================
-- Trigger อัตโนมัติสำหรับสร้างแถวใน profiles เมื่อสมัครสมาชิกใหม่
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, bike_model)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'bike_model', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- สร้าง Storage Bucket 'biker-gallery' และ RLS สำหรับอัปโหลดรูปภาพ
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('biker-gallery', 'biker-gallery', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public can view biker-gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload biker-gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own biker-gallery images" ON storage.objects;

CREATE POLICY "Public can view biker-gallery images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'biker-gallery');

CREATE POLICY "Authenticated users can upload biker-gallery images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'biker-gallery');

CREATE POLICY "Users can delete own biker-gallery images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'biker-gallery');
