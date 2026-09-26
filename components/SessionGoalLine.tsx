import React from 'react';
import type { UITranslations } from '../services/i18n';
import { scoreSessionGoal, type SessionGoal } from '../services/sessionPlan';

export interface GoalStats { wpm?: number; accuracy?: number; consistency?: number }

// Closes the loop "Play" opened: the focus this session was built to train,
// before and after, in one line at the top of the debrief.
const SessionGoalLine: React.FC<{ goal: SessionGoal | null; stats: GoalStats; ui: UITranslations }> = ({ goal, stats, ui }) => {
    if (!goal) return null;
    const value = goal.metric === 'wpm' ? stats.wpm : goal.metric === 'accuracy' ? stats.accuracy : stats.consistency;
    if (value === undefined || !Number.isFinite(value)) return null;
    const result = scoreSessionGoal(goal, value);
    const unit = goal.metric === 'wpm' ? ` ${ui.wpm}` : '%';
    const verdict = result.before === null ? ui.session_goal_first : result.better ? '✓' : '↓';
    return (
        <p className={`session-goal ${result.better ? 'is-better' : 'is-worse'}`}>
            <span className="session-goal-label">{ui.session_goal}</span>
            <span className="session-goal-value">
                {ui[`focus_name_${goal.focus}` as const]}{' '}
                {result.before !== null && <>{result.before}{unit} → </>}
                <strong>{result.after}{unit}</strong> <span className="session-goal-verdict">{verdict}</span>
            </span>
        </p>
    );
};

export default SessionGoalLine;
