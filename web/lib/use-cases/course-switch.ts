/**
 * UC-03 · Course switcher (ARCHITECTURE.md §1.1). Only `en-c1` exists today
 * — `listCourses` still enumerates properly so the switcher UI has real
 * data to render (even if there's just one entry) once a second course
 * ships.
 */
import * as courseRepo from '../repositories/course.repo';
import type { CourseDTO } from '../repositories/course.repo';

export async function listAvailableCourses(): Promise<CourseDTO[]> {
  return courseRepo.listCourses();
}

export async function switchCourse(userId: number, courseSlug: string): Promise<CourseDTO> {
  const course = await courseRepo.getCourseBySlug(courseSlug);
  if (!course) throw new Error(`Course not found: ${courseSlug}`);
  await courseRepo.setActiveCourse(userId, course.id);
  return course;
}
