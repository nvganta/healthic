// Shared utilities
export { callEvalApi, clampScore, EvalApiError, EVAL_CONFIG } from './utils';

// Core evaluations
export { evaluateActionability, runActionabilityEval, actionabilityTestCases } from './actionability';
export { evaluatePersonalization, runPersonalizationEval, personalizationTestCases } from './personalization';
export { evaluateSafety, runSafetyEval, safetyTestCases } from './safety';

// Decision Quality evaluations
export { 
  evaluateCheckInTiming, 
  runCheckInTimingEval, 
  checkInTimingTestCases,
  evaluateToneMatching,
  runToneMatchingEval,
  toneMatchingTestCases 
} from './decision-quality';

// Goal Decomposition evaluation
export { 
  evaluateGoalDecomposition, 
  runGoalDecompositionEval, 
  goalDecompositionTestCases 
} from './goal-decomposition';

// Hallucination Detection evaluation
export { 
  evaluateHallucination, 
  runHallucinationEval, 
  hallucinationTestCases 
} from './hallucination';

// Synthetic Test Scenarios
export {
  syntheticScenarios,
  runScenario,
  getScenariosByCategory,
  listScenarios,
  exportScenarioAsMarkdown,
  type SyntheticScenario,
  type ConversationTurn,
  type ScenarioResult,
} from './synthetic-scenarios';

// Imports for runAllEvals
import { runActionabilityEval } from './actionability';
import { runPersonalizationEval } from './personalization';
import { runSafetyEval } from './safety';
import { runCheckInTimingEval, runToneMatchingEval } from './decision-quality';
import { runGoalDecompositionEval } from './goal-decomposition';
import { runHallucinationEval } from './hallucination';

// ============================================================================
// TYPES
// ============================================================================

/** Standard result type for all eval runners */
export type EvalResult = {
  passed: number;
  failed: number;
  results: Array<{
    name: string;
    passed: boolean;
    score: number;
    reason: string;
  }>;
};

/** Available eval categories */
export type EvalCategory = 
  | 'actionability' 
  | 'personalization' 
  | 'safety' 
  | 'checkInTiming' 
  | 'toneMatching' 
  | 'goalDecomposition' 
  | 'hallucination';

/** Full eval suite results */
export interface EvalSuiteResults {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    passRate: number;
    timestamp: string;
    duration: number;
  };
  actionability: EvalResult;
  personalization: EvalResult;
  safety: EvalResult;
  checkInTiming: EvalResult;
  toneMatching: EvalResult;
  goalDecomposition: EvalResult;
  hallucination: EvalResult;
}

// ============================================================================
// EVAL RUNNERS
// ============================================================================

/** Map of eval categories to their runner functions */
const evalRunners: Record<EvalCategory, () => Promise<EvalResult>> = {
  actionability: runActionabilityEval,
  personalization: runPersonalizationEval,
  safety: runSafetyEval,
  checkInTiming: runCheckInTimingEval,
  toneMatching: runToneMatchingEval,
  goalDecomposition: runGoalDecompositionEval,
  hallucination: runHallucinationEval,
};

/**
 * Run a specific eval category
 * @param category - The eval category to run
 * @returns The eval results
 */
export async function runEvalCategory(category: EvalCategory): Promise<EvalResult> {
  const runner = evalRunners[category];
  if (!runner) {
    throw new Error(`Unknown eval category: ${category}`);
  }
  return runner();
}

/**
 * Run multiple eval categories
 * @param categories - Array of eval categories to run
 * @returns Map of category to results
 */
export async function runEvalCategories(
  categories: EvalCategory[]
): Promise<Record<string, EvalResult>> {
  const results: Record<string, EvalResult> = {};
  
  for (const category of categories) {
    console.log(`📋 Running ${category} Eval...`);
    results[category] = await runEvalCategory(category);
    console.log(`   ✓ ${category}: ${results[category].passed}/${results[category].passed + results[category].failed} passed\n`);
  }
  
  return results;
}

/**
 * Run all evaluation suites and return aggregated results.
 * This is useful for CI/CD pipelines or manual evaluation runs.
 * 
 * @example
 * ```typescript
 * const results = await runAllEvals();
 * console.log(`Pass rate: ${results.summary.passRate}%`);
 * ```
 */
export async function runAllEvals(): Promise<EvalSuiteResults> {
  const startTime = Date.now();
  console.log('🧪 Running Healthic Evaluation Suite...\n');
  console.log('=' .repeat(50));

  // Core evaluations
  console.log('\n📦 CORE EVALUATIONS\n');
  
  console.log('📋 Running Actionability Eval...');
  const actionability = await runActionabilityEval();
  console.log(`   ✓ Actionability: ${actionability.passed}/${actionability.passed + actionability.failed} passed\n`);

  console.log('📋 Running Personalization Eval...');
  const personalization = await runPersonalizationEval();
  console.log(`   ✓ Personalization: ${personalization.passed}/${personalization.passed + personalization.failed} passed\n`);

  console.log('📋 Running Safety Eval...');
  const safety = await runSafetyEval();
  console.log(`   ✓ Safety: ${safety.passed}/${safety.passed + safety.failed} passed\n`);

  // Decision quality evaluations
  console.log('🎯 DECISION QUALITY EVALUATIONS\n');
  
  console.log('📋 Running Check-in Timing Eval...');
  const checkInTiming = await runCheckInTimingEval();
  console.log(`   ✓ Check-in Timing: ${checkInTiming.passed}/${checkInTiming.passed + checkInTiming.failed} passed\n`);

  console.log('📋 Running Tone Matching Eval...');
  const toneMatching = await runToneMatchingEval();
  console.log(`   ✓ Tone Matching: ${toneMatching.passed}/${toneMatching.passed + toneMatching.failed} passed\n`);

  // Goal decomposition evaluation
  console.log('📦 GOAL DECOMPOSITION EVALUATION\n');
  
  console.log('📋 Running Goal Decomposition Eval...');
  const goalDecomposition = await runGoalDecompositionEval();
  console.log(`   ✓ Goal Decomposition: ${goalDecomposition.passed}/${goalDecomposition.passed + goalDecomposition.failed} passed\n`);

  // Hallucination detection evaluation
  console.log('🔍 HALLUCINATION DETECTION EVALUATION\n');
  
  console.log('📋 Running Hallucination Detection Eval...');
  const hallucination = await runHallucinationEval();
  console.log(`   ✓ Hallucination Detection: ${hallucination.passed}/${hallucination.passed + hallucination.failed} passed\n`);

  // Calculate totals
  const allResults = [
    actionability, 
    personalization, 
    safety, 
    checkInTiming, 
    toneMatching, 
    goalDecomposition, 
    hallucination
  ];
  
  const totalTests = allResults.reduce((sum, r) => sum + r.passed + r.failed, 0);
  const totalPassed = allResults.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = allResults.reduce((sum, r) => sum + r.failed, 0);
  const passRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;
  const duration = Date.now() - startTime;

  console.log('=' .repeat(50));
  console.log('\n📊 FINAL SUMMARY\n');
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   ✅ Passed: ${totalPassed}`);
  console.log(`   ❌ Failed: ${totalFailed}`);
  console.log(`   📈 Pass Rate: ${passRate.toFixed(1)}%`);
  console.log(`   ⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
  console.log('\n' + '=' .repeat(50));

  // Detailed breakdown by category
  console.log('\n📋 BREAKDOWN BY CATEGORY:\n');
  const categories = [
    { name: 'Actionability', result: actionability },
    { name: 'Personalization', result: personalization },
    { name: 'Safety', result: safety },
    { name: 'Check-in Timing', result: checkInTiming },
    { name: 'Tone Matching', result: toneMatching },
    { name: 'Goal Decomposition', result: goalDecomposition },
    { name: 'Hallucination', result: hallucination },
  ];
  
  for (const cat of categories) {
    const catPassRate = ((cat.result.passed / (cat.result.passed + cat.result.failed)) * 100).toFixed(0);
    const status = cat.result.failed === 0 ? '✅' : '⚠️';
    console.log(`   ${status} ${cat.name}: ${catPassRate}% (${cat.result.passed}/${cat.result.passed + cat.result.failed})`);
  }

  return {
    summary: {
      totalTests,
      passed: totalPassed,
      failed: totalFailed,
      passRate,
      timestamp: new Date().toISOString(),
      duration,
    },
    actionability,
    personalization,
    safety,
    checkInTiming,
    toneMatching,
    goalDecomposition,
    hallucination,
  };
}
