'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { switchCourse } from '@/app/actions/course';

/**
 * UC-03 course switching, shared by SideRail (desktop) and HeaderBar (mobile).
 *
 * Lands on /course rather than staying put: module and session routes carry the
 * course slug in the path, so a learner who switches while sitting on
 * /course/en-c1/module/m01 would otherwise keep reading English while the nav
 * claims they are studying German. The course map is the natural place to
 * arrive — it is what you wanted to see when you switched.
 */
export function useCourseSwitch() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(slug: string) {
    startTransition(async () => {
      await switchCourse(slug);
      router.push('/course');
      router.refresh();
    });
  }

  return { switchTo, pending };
}
