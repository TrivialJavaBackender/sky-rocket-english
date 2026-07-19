/**
 * Testing/dev affordance — a one-user app currently has no other way to get
 * back to a clean slate short of re-running migrate/sync/seed-user. Not a
 * real product use case (no UC-N in ARCHITECTURE.md); see the Progress
 * screen's "Danger zone" card.
 */
import * as maintenanceRepo from '../repositories/maintenance.repo';

export async function resetAllProgress(userId: number): Promise<void> {
  await maintenanceRepo.resetAllProgress(userId);
}
