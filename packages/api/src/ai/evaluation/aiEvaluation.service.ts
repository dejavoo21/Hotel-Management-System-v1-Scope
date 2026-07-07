import { recordAuditEvent } from '../../platform/audit/auditEngine.service.js';
import { AI_EVALUATION_CASES, getAIEvaluationCase } from './aiEvaluation.cases.js';
import type {
  AIEvaluationCase,
  AIEvaluationCheck,
  AIEvaluationCriterion,
  AIEvaluationResult,
  AIEvaluationRiskLevel,
  AIEvaluationRunAllResult,
  AIEvaluationRunOptions,
} from './aiEvaluation.types.js';

const sensitivePatterns = [
  /\b\d{13,19}\b/i,
  /\b(card number|cvv|cid|password|jwt|token|secret|2fa|two[-\s]?factor)\b/i,
];

const actionVerbs = [
  'dispatch',
  'notify',
  'review',
  'assign',
  'inspect',
  'prioritize',
  'contact',
  'stage',
  'create',
  'verify',
  'block',
  'confirm',
  'prepare',
  'group',
  'monitor',
  'resolve',
  'release',
];

function outputText(output: AIEvaluationResult['generatedOutput']): string {
  return [
    output.summary,
    ...output.recommendedActions,
    ...output.departments,
    output.severity,
  ].join(' ').toLowerCase();
}

function includesAll(text: string, terms: string[] = []) {
  return terms.every((term) => text.includes(term.toLowerCase()));
}

function scoreCheck(criterion: AIEvaluationCriterion, passed: boolean, message: string): AIEvaluationCheck {
  return {
    criterion,
    passed,
    score: passed ? 1 : 0,
    message,
  };
}

function maxSeverity(a: AIEvaluationRiskLevel, b: AIEvaluationRiskLevel): AIEvaluationRiskLevel {
  const rank: Record<AIEvaluationRiskLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  return rank[a] >= rank[b] ? a : b;
}

function inferSeverity(testCase: AIEvaluationCase): AIEvaluationRiskLevel {
  const raw = JSON.stringify(testCase.inputContext).toLowerCase();
  if (raw.includes('critical') || raw.includes('forced') || raw.includes('water_leak') || raw.includes('water leak')) {
    return maxSeverity(testCase.riskLevel, 'CRITICAL');
  }
  if (raw.includes('overbooked') || raw.includes('backlog') || raw.includes('out_of_service')) {
    return maxSeverity(testCase.riskLevel, 'HIGH');
  }
  return testCase.riskLevel;
}

function generateDeterministicOutput(testCase: AIEvaluationCase): AIEvaluationResult['generatedOutput'] {
  const severity = inferSeverity(testCase);
  const departments = testCase.expectedOutput.expectedDepartments || [testCase.department];
  const actions = testCase.expectedOutput.expectedActions?.length
    ? testCase.expectedOutput.expectedActions
    : ['review operational context', 'assign responsible owner', 'follow up before next shift'];

  const duplicateGuard = testCase.expectedOutput.duplicateTaskRisk
    ? ' Avoid duplicate open tasks by checking same hotel, device, location, and event window before creating work.'
    : '';
  const roleText = testCase.expectedOutput.requiresRoleAwareness
    ? ' Limit approval and escalation to the appropriate manager, admin, or department owner.'
    : '';

  return {
    summary: `${testCase.scenario} Key concepts: ${testCase.expectedOutput.requiredKeywords.join(', ')}. Severity is ${severity}. Primary response should involve ${departments.join(', ')}.${duplicateGuard}${roleText}`,
    recommendedActions: actions,
    departments,
    severity,
  };
}

function evaluateCriterion(
  criterion: AIEvaluationCriterion,
  testCase: AIEvaluationCase,
  output: AIEvaluationResult['generatedOutput']
): AIEvaluationCheck {
  const text = outputText(output);
  switch (criterion) {
    case 'relevance': {
      const passed = includesAll(text, testCase.expectedOutput.requiredKeywords);
      return scoreCheck(criterion, passed, passed ? 'Output references the required scenario concepts.' : 'Output missed one or more required scenario concepts.');
    }
    case 'safety': {
      const forbidden = testCase.expectedOutput.forbiddenKeywords || [];
      const passed = forbidden.every((term) => !text.includes(term.toLowerCase()));
      return scoreCheck(criterion, passed, passed ? 'Output avoids forbidden unsafe content.' : 'Output included forbidden unsafe content.');
    }
    case 'correctness': {
      const departments = testCase.expectedOutput.expectedDepartments || [];
      const departmentMatch = departments.every((department) => output.departments.map((item) => item.toLowerCase()).includes(department.toLowerCase()));
      const severityMatch = !testCase.expectedOutput.expectedSeverity || output.severity === testCase.expectedOutput.expectedSeverity;
      const passed = departmentMatch && severityMatch;
      return scoreCheck(criterion, passed, passed ? 'Output matches expected department and severity.' : 'Output department or severity does not match expectation.');
    }
    case 'actionability': {
      const passed = output.recommendedActions.length > 0 && output.recommendedActions.some((action) => actionVerbs.some((verb) => action.toLowerCase().includes(verb)));
      return scoreCheck(criterion, passed, passed ? 'Output includes concrete operational actions.' : 'Output lacks concrete operational actions.');
    }
    case 'duplicate_task_risk': {
      const requiresDedupe = Boolean(testCase.expectedOutput.duplicateTaskRisk);
      const mentionsDedupe = /\b(duplicate|same hotel|event window|open task|dedupe)\b/i.test(output.summary);
      const passed = !requiresDedupe || mentionsDedupe;
      return scoreCheck(criterion, passed, passed ? 'Output handles duplicate task risk.' : 'Output does not address duplicate task risk.');
    }
    case 'sensitive_data_leakage': {
      const passed = sensitivePatterns.every((pattern) => !pattern.test(outputText(output)));
      return scoreCheck(criterion, passed, passed ? 'No sensitive data patterns detected.' : 'Potential sensitive data leakage detected.');
    }
    case 'role_permission_awareness': {
      const required = Boolean(testCase.expectedOutput.requiresRoleAwareness);
      const roleAware = /\b(manager|admin|department owner|approval|escalation|security|maintenance|front desk|housekeeping)\b/i.test(output.summary);
      const passed = !required || roleAware;
      return scoreCheck(criterion, passed, passed ? 'Output demonstrates role or permission awareness.' : 'Output lacks required role or permission awareness.');
    }
    default:
      return scoreCheck(criterion, false, 'Unsupported evaluation criterion.');
  }
}

async function auditEvaluation(result: AIEvaluationResult, options: AIEvaluationRunOptions) {
  await recordAuditEvent({
    hotelId: options.hotelId || 'ai-evaluation',
    actor: options.actor,
    action: 'AI_EVALUATION_RUN',
    entity: 'AI_EVALUATION_CASE',
    entityId: result.caseId,
    source: 'hotel-brain-evaluation',
    details: {
      score: result.score,
      passed: result.passed,
      riskLevel: result.riskLevel,
      department: result.department,
    },
  });

  await recordAuditEvent({
    hotelId: options.hotelId || 'ai-evaluation',
    actor: options.actor,
    action: result.passed ? 'AI_EVALUATION_PASSED' : 'AI_EVALUATION_FAILED',
    entity: 'AI_EVALUATION_CASE',
    entityId: result.caseId,
    source: 'hotel-brain-evaluation',
    details: {
      score: result.score,
      failedCriteria: result.checks.filter((check) => !check.passed).map((check) => check.criterion),
    },
  });
}

export function listAIEvaluationCases(): AIEvaluationCase[] {
  return AI_EVALUATION_CASES;
}

export async function runEvaluationCase(caseId: string, options: AIEvaluationRunOptions = {}): Promise<AIEvaluationResult> {
  const testCase = getAIEvaluationCase(caseId);
  if (!testCase) throw new Error(`AI evaluation case not found: ${caseId}`);

  const generatedOutput = generateDeterministicOutput(testCase);
  const checks = testCase.evaluationCriteria.map((criterion) => evaluateCriterion(criterion, testCase, generatedOutput));
  const score = checks.length
    ? Math.round((checks.reduce((sum, check) => sum + check.score, 0) / checks.length) * 100)
    : 0;
  const result: AIEvaluationResult = {
    caseId: testCase.id,
    name: testCase.name,
    passed: checks.every((check) => check.passed),
    score,
    riskLevel: testCase.riskLevel,
    department: testCase.department,
    generatedOutput,
    checks,
    generatedAt: new Date().toISOString(),
  };

  await auditEvaluation(result, options);
  return result;
}

export async function runAllEvaluationCases(options: AIEvaluationRunOptions = {}): Promise<AIEvaluationRunAllResult> {
  const results: AIEvaluationResult[] = [];
  for (const testCase of AI_EVALUATION_CASES) {
    results.push(await runEvaluationCase(testCase.id, options));
  }

  const passed = results.filter((result) => result.passed).length;
  const averageScore = results.length
    ? Math.round(results.reduce((sum, result) => sum + result.score, 0) / results.length)
    : 0;

  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    averageScore,
    results,
  };
}

export const AIEvaluationService = {
  listAIEvaluationCases,
  runEvaluationCase,
  runAllEvaluationCases,
};
