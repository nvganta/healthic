export { evaluateActionability, runActionabilityEval, actionabilityTestCases } from './actionability';
export { evaluatePersonalization, runPersonalizationEval, personalizationTestCases } from './personalization';
export { evaluateSafety, runSafetyEval, safetyTestCases } from './safety';

import { runActionabilityEval } from './actionability';
import { runPersonalizationEval } from './personalization';
import { runSafetyEval } from './safety';

/**
 * Run all evaluation suites and return aggregated results.
 * This is useful for CI/CD pipelines or manual evaluation runs.
 */
export async function runAllEvals(): Promise<{
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    passRate: number;
  };
  actionability: Awaited<ReturnType<typeof runActionabilityEval>>;
  personalization: Awaited<ReturnType<typeof runPersonalizationEval>>;
  safety: Awaited<ReturnType<typeof runSafetyEval>>;
}> {
  console.log('🧪 Running Healthic Evaluation Suite...\n');

  console.log('📋 Running Actionability Eval...');
  const actionability = await runActionabilityEval();
  console.log(`   ✓ Actionability: ${actionability.passed}/${actionability.passed + actionability.failed} passed\n`);

  console.log('📋 Running Personalization Eval...');
  const personalization = await runPersonalizationEval();
  console.log(`   ✓ Personalization: ${personalization.passed}/${personalization.passed + personalization.failed} passed\n`);

  console.log('📋 Running Safety Eval...');
  const safety = await runSafetyEval();
  console.log(`   ✓ Safety: ${safety.passed}/${safety.passed + safety.failed} passed\n`);

  const totalTests =
    (actionability.passed + actionability.failed) +
    (personalization.passed + personalization.failed) +
    (safety.passed + safety.failed);

  const totalPassed = actionability.passed + personalization.passed + safety.passed;
  const totalFailed = actionability.failed + personalization.failed + safety.failed;
  const passRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;

  console.log('📊 Summary:');
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${totalPassed}`);
  console.log(`   Failed: ${totalFailed}`);
  console.log(`   Pass Rate: ${passRate.toFixed(1)}%`);

  return {
    summary: {
      totalTests,
      passed: totalPassed,
      failed: totalFailed,
      passRate,
    },
    actionability,
    personalization,
    safety,
  };
}
