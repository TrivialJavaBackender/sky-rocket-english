/**
 * UC-03 · Course switcher (ARCHITECTURE.md §1.1). Two courses ship today
 * (`en-c1`, `de-a2`); `listCourses` enumerates whatever course.yaml skeletons
 * the sync created, so the switcher needs no change when a third arrives.
 */
import * as courseRepo from '../repositories/course.repo';
import type { CourseDTO } from '../repositories/course.repo';

export async function listAvailableCourses(): Promise<CourseDTO[]> {
  return courseRepo.listCourses();
}

/**
 * The course the learner is actually enrolled in — not the first row of
 * listAvailableCourses(), which is merely the lowest `position` and stops being
 * the right answer the moment a second course exists.
 */
export async function getActiveCourse(userId: number): Promise<CourseDTO | null> {
  return courseRepo.getActiveCourseForUser(userId);
}

export async function switchCourse(userId: number, courseSlug: string): Promise<CourseDTO> {
  const course = await courseRepo.getCourseBySlug(courseSlug);
  if (!course) throw new Error(`Course not found: ${courseSlug}`);
  await courseRepo.setActiveCourse(userId, course.id);
  return course;
}
