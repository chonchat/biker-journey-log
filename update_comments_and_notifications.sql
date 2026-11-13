-- ============================================================
-- SQL รวมระบบ: ยอดไลค์ (trip_reactions) + ความคิดเห็น (trip_comments) + ระบบแจ้งเตือน (notifications)
-- คัดลอกโค้ดทั้งหมดนี้ไปวางใน Supabase Dashboard -> SQL Editor แล้วกดปุ่ม RUN
-- ============================================================

-- 1. ตาราง trip_reactions (สำหรับระบบกด Like / Dislike ให้ยอดไลค์ขึ้นและเห็นร่วมกันทุกคน)
CREATE TABLE IF NOT EXISTS public.trip_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'dislike')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (trip_id, user_id)
);

ALTER TABLE public.trip_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_reactions_select ON public.trip_reactions;
DROP POLICY IF EXISTS auth_reactions_all ON public.trip_reactions;
DROP POLICY IF EXISTS "Public can view reactions" ON public.trip_reactions;
DROP POLICY IF EXISTS "Authenticated users can manage own reactions" ON public.trip_reactions;

CREATE POLICY public_reactions_select
  ON public.trip_reactions FOR SELECT
  USING (true);

CREATE POLICY auth_reactions_all
  ON public.trip_reactions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_reactions;


-- 2. ตาราง trip_comments (สำหรับบันทึกความคิดเห็นในทริปของทุกคน)
CREATE TABLE IF NOT EXISTS public.trip_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.trip_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.trip_comments ENABLE ROW LEVEL SECURITY;

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


-- 3. ตาราง notifications (สำหรับระบบแจ้งเตือนเจ้าของทริปเมื่อมีคนคอมเมนต์)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- ผู้รับแจ้งเตือน (เจ้าของทริป)
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,       -- ผู้คอมเมนต์
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,   -- ทริปที่ถูกคอมเมนต์
  comment_id UUID REFERENCES public.trip_comments(id) ON DELETE CASCADE, -- ไอดีคอมเมนต์
  type TEXT NOT NULL DEFAULT 'comment',                                  -- ประเภทการแจ้งเตือน
  message TEXT NOT NULL,                                                 -- ข้อความแจ้งเตือน
  is_read BOOLEAN DEFAULT false,                                         -- สถานะอ่านแล้วหรือยัง
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ลบข้อมูลการแจ้งเตือนที่ซ้ำกันในอดีต (ถ้ามี) ให้เหลือเพียง 1 รายการต่อ 1 คอมเมนต์
DELETE FROM public.notifications a
USING public.notifications b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND (
    (a.comment_id IS NOT NULL AND a.comment_id = b.comment_id)
    OR (a.trip_id = b.trip_id AND a.actor_id = b.actor_id AND a.message = b.message AND abs(extract(epoch from (a.created_at - b.created_at))) < 10)
  );

-- สร้าง Unique Index ป้องกันการสร้างการแจ้งเตือนซ้ำสำหรับคอมเมนต์เดียวกัน
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_comment_user
  ON public.notifications (comment_id, user_id)
  WHERE comment_id IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

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


-- 4. Trigger อัตโนมัติ: เมื่อมีคนคอมเมนต์ ให้สร้างการแจ้งเตือนไปยังเจ้าของทริปทันที
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


-- 5. เปิด Realtime สำหรับ trip_reactions, trip_comments และ notifications
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_reactions;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_comments;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
