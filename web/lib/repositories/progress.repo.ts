/**
 * Cross-table aggregates for the Progress screen (ARCHITECTURE §1.1 UC-04).
 * Reads span several content/progress tables — domain/progress.ts turns the
 * raw counts into percentages.
 */
import { prisma } from '../db';
import { idToNumber } from '../serialize';

export interface VocabStats {
  total: number;
  knownPlusInUse: number;
}

export async function getVocabStats(userId: number, courseId: number): Promise<VocabStats> {
  const total = await prisma.vocab_entry.count({ where: { module: { block: { course_id: courseId } } } });
  const knownPlusInUse = await prisma.user_vocab_state.count({
    where: { user_id: userId, status: { in: ['known', 'in_use'] }, vocab_entry: { module: { block: { course_id: courseId } } } },
  });
  return { total, knownPlusInUse };
}

export interface GrammarStats {
  total: number;
  reliable: number;
}

export async function getGrammarStats(userId: number, courseId: number): Promise<GrammarStats> {
  const total = await prisma.grammar_point.count({ where: { module: { block: { course_id: courseId } } } });
  const reliable = await prisma.user_grammar_state.count({
    where: { user_id: userId, status: 'reliable', grammar_point: { module: { block: { course_id: courseId } } } },
  });
  return { total, reliable };
}

export interface BlockProgressDTO {
  blockId: number;
  totalModules: number;
  completedOrBetter: number;
}

export interface MasteredModuleStats {
  total: number;
  mastered: number;
}

/** For the "course complete" state (§1.1 UC-04): every module in the course must be `mastered`, not just `completed`. */
export async function getMasteredModuleStats(userId: number, courseId: number): Promise<MasteredModuleStats> {
  const total = await prisma.module.count({ where: { block: { course_id: courseId } } });
  const mastered = await prisma.user_module_state.count({ where: { user_id: userId, status: 'mastered', module: { block: { course_id: courseId } } } });
  return { total, mastered };
}

export async function getBlockProgress(userId: number, courseId: number): Promise<BlockProgressDTO[]> {
  const blocks = await prisma.block.findMany({ where: { course_id: courseId }, orderBy: { position: 'asc' } });
  const results: BlockProgressDTO[] = [];
  for (const b of blocks) {
    const totalModules = await prisma.module.count({ where: { block_id: b.id } });
    const completedOrBetter = await prisma.user_module_state.count({
      where: { user_id: userId, status: { in: ['completed', 'mastered'] }, module: { block_id: b.id } },
    });
    results.push({ blockId: idToNumber(b.id), totalModules, completedOrBetter });
  }
  return results;
}
