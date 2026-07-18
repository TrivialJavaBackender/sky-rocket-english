import { Card } from '@/components/ui/Card';
import { Kicker } from '@/components/ui/Kicker';

/** "IN THIS UNIT" goals card (UC-05) + the session-4 "before you close the unit" checklist re-use the same list shape. */
export function GoalsList({ goals, kicker = 'In this unit' }: { goals: string[]; kicker?: string }) {
  return (
    <Card className="mb-3.5">
      <Kicker className="mb-1">{kicker}</Kicker>
      {goals.map((g, i) => (
        <div key={i} className="flex gap-3 border-t border-border-faint py-[9px] text-[15px] first:border-t-0">
          <span className="mt-[7px] h-2 w-2 flex-none rounded-sm bg-green" />
          <span>{g}</span>
        </div>
      ))}
    </Card>
  );
}
