import { getCurrentUserId } from '@/lib/current-user';
import { getCourseMap } from '@/lib/use-cases/course-map';
import { CourseMap } from '@/components/map/CourseMap';

// Per-user module/checkpoint statuses change as progress is made — must be dynamic, not build-time static (see app/page.tsx).
export const dynamic = 'force-dynamic';

// UC-02 Course map (ARCHITECTURE.md §1.1, §7.1 `/course`).
export default async function CoursePage() {
  const userId = await getCurrentUserId();
  const map = await getCourseMap(userId);
  return <CourseMap map={map} />;
}
