import { runAllEvaluationCases } from '../src/ai/evaluation/index.js';

async function main() {
  const result = await runAllEvaluationCases();
  console.log(JSON.stringify({
    total: result.total,
    passed: result.passed,
    failed: result.failed,
    averageScore: result.averageScore,
    cases: result.results.map((item) => ({
      id: item.caseId,
      name: item.name,
      passed: item.passed,
      score: item.score,
      failedCriteria: item.checks.filter((check) => !check.passed).map((check) => check.criterion),
    })),
  }, null, 2));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
