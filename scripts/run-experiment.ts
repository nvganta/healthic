/**
 * Opik Experiment Runner
 *
 * This script:
 * 1. Runs all evaluation test cases
 * 2. Logs results as traces to Opik
 * 3. Populates your dashboards with real data
 *
 * Run with: npx tsx scripts/run-experiment.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local BEFORE any other imports
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  });
  console.log('✓ Loaded environment from .env.local\n');
} else {
  console.error('❌ .env.local not found. Please create it with OPIK_API_KEY and GOOGLE_GENAI_API_KEY');
  process.exit(1);
}

// Verify required env vars
if (!process.env.OPIK_API_KEY) {
  console.error('❌ OPIK_API_KEY not found in .env.local');
  process.exit(1);
}
if (!process.env.GOOGLE_GENAI_API_KEY) {
  console.error('❌ GOOGLE_GENAI_API_KEY not found in .env.local');
  process.exit(1);
}

/**
 * Main function - run all experiments
 */
async function main() {
  console.log('🧪 Healthic Opik Experiment Runner\n');
  console.log('This will run evaluations and log traces to Opik.\n');

  // Dynamic imports AFTER env vars are loaded
  const { Opik } = await import('opik');
  const { actionabilityTestCases, evaluateActionability } = await import('../src/lib/evals/actionability');
  const { personalizationTestCases, evaluatePersonalization } = await import('../src/lib/evals/personalization');
  const { safetyTestCases, evaluateSafety } = await import('../src/lib/evals/safety');

  // Initialize Opik client
  const opik = new Opik({ projectName: 'healthic-evals' });

  const experimentId = `experiment-${Date.now()}`;

  /**
   * Run actionability experiment
   */
  async function runActionabilityExperiment() {
    console.log('\n📋 Running Actionability Experiment...');

    const results: Array<{ name: string; score: number; passed: boolean; reason: string }> = [];

    for (const testCase of actionabilityTestCases) {
      const trace = opik.trace({
        name: 'actionability_experiment',
        input: { userMessage: testCase.input, agentResponse: testCase.output },
        metadata: {
          evalType: 'actionability',
          testCaseName: testCase.name,
          experimentId,
        },
      });

      try {
        const result = await evaluateActionability({
          input: testCase.input,
          output: testCase.output,
        });

        const passed = result.score >= testCase.expectedScoreRange[0] &&
                       result.score <= testCase.expectedScoreRange[1];

        trace.update({
          output: result as unknown as Record<string, unknown>,
          metadata: {
            score: result.score,
            passed,
            expectedMin: testCase.expectedScoreRange[0],
            expectedMax: testCase.expectedScoreRange[1],
          },
        });

        results.push({
          name: testCase.name,
          score: result.score,
          passed,
          reason: result.reason,
        });

        console.log(`  ${passed ? '✓' : '✗'} ${testCase.name}: ${result.score.toFixed(2)} (expected ${testCase.expectedScoreRange[0]}-${testCase.expectedScoreRange[1]})`);
      } catch (error) {
        console.error(`  ✗ ${testCase.name}: Error - ${error}`);
        trace.update({
          output: { error: String(error) },
          metadata: { status: 'error' },
        });
        results.push({
          name: testCase.name,
          score: 0,
          passed: false,
          reason: String(error),
        });
      }

      trace.end();
    }

    await opik.flush();

    const passedCount = results.filter(r => r.passed).length;
    console.log(`\n  Summary: ${passedCount}/${results.length} passed`);

    return results;
  }

  /**
   * Run personalization experiment
   */
  async function runPersonalizationExperiment() {
    console.log('\n📋 Running Personalization Experiment...');

    const results: Array<{ name: string; score: number; passed: boolean; reason: string }> = [];

    for (const testCase of personalizationTestCases) {
      const trace = opik.trace({
        name: 'personalization_experiment',
        input: {
          context: testCase.context,
          userMessage: testCase.input,
          agentResponse: testCase.output
        },
        metadata: {
          evalType: 'personalization',
          testCaseName: testCase.name,
          experimentId,
        },
      });

      try {
        const result = await evaluatePersonalization({
          context: testCase.context,
          input: testCase.input,
          output: testCase.output,
        });

        const passed = result.score >= testCase.expectedScoreRange[0] &&
                       result.score <= testCase.expectedScoreRange[1];

        trace.update({
          output: result as unknown as Record<string, unknown>,
          metadata: {
            score: result.score,
            passed,
            expectedMin: testCase.expectedScoreRange[0],
            expectedMax: testCase.expectedScoreRange[1],
          },
        });

        results.push({
          name: testCase.name,
          score: result.score,
          passed,
          reason: result.reason,
        });

        console.log(`  ${passed ? '✓' : '✗'} ${testCase.name}: ${result.score.toFixed(2)} (expected ${testCase.expectedScoreRange[0]}-${testCase.expectedScoreRange[1]})`);
      } catch (error) {
        console.error(`  ✗ ${testCase.name}: Error - ${error}`);
        trace.update({
          output: { error: String(error) },
          metadata: { status: 'error' },
        });
        results.push({
          name: testCase.name,
          score: 0,
          passed: false,
          reason: String(error),
        });
      }

      trace.end();
    }

    await opik.flush();

    const passedCount = results.filter(r => r.passed).length;
    console.log(`\n  Summary: ${passedCount}/${results.length} passed`);

    return results;
  }

  /**
   * Run safety experiment
   */
  async function runSafetyExperiment() {
    console.log('\n📋 Running Safety Experiment...');

    const results: Array<{ name: string; score: number; passed: boolean; reason: string; concerns: string[] }> = [];

    for (const testCase of safetyTestCases) {
      const trace = opik.trace({
        name: 'safety_experiment',
        input: { userMessage: testCase.input, agentResponse: testCase.output },
        metadata: {
          evalType: 'safety',
          testCaseName: testCase.name,
          experimentId,
        },
      });

      try {
        const result = await evaluateSafety({
          input: testCase.input,
          output: testCase.output,
        });

        const passed = result.score >= testCase.expectedScoreRange[0] &&
                       result.score <= testCase.expectedScoreRange[1];

        trace.update({
          output: result as unknown as Record<string, unknown>,
          metadata: {
            score: result.score,
            passed,
            expectedMin: testCase.expectedScoreRange[0],
            expectedMax: testCase.expectedScoreRange[1],
            concerns: result.concerns,
          },
        });

        results.push({
          name: testCase.name,
          score: result.score,
          passed,
          reason: result.reason,
          concerns: result.concerns || [],
        });

        console.log(`  ${passed ? '✓' : '✗'} ${testCase.name}: ${result.score.toFixed(2)} (expected ${testCase.expectedScoreRange[0]}-${testCase.expectedScoreRange[1]})`);
      } catch (error) {
        console.error(`  ✗ ${testCase.name}: Error - ${error}`);
        trace.update({
          output: { error: String(error) },
          metadata: { status: 'error' },
        });
        results.push({
          name: testCase.name,
          score: 0,
          passed: false,
          reason: String(error),
          concerns: [],
        });
      }

      trace.end();
    }

    await opik.flush();

    const passedCount = results.filter(r => r.passed).length;
    console.log(`\n  Summary: ${passedCount}/${results.length} passed`);

    return results;
  }

  try {
    // Run all experiments
    const actionabilityResults = await runActionabilityExperiment();
    const personalizationResults = await runPersonalizationExperiment();
    const safetyResults = await runSafetyExperiment();

    // Calculate totals
    const totalTests = actionabilityResults.length + personalizationResults.length + safetyResults.length;
    const totalPassed =
      actionabilityResults.filter(r => r.passed).length +
      personalizationResults.filter(r => r.passed).length +
      safetyResults.filter(r => r.passed).length;

    console.log('\n' + '='.repeat(50));
    console.log('📊 OVERALL RESULTS');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${totalPassed}`);
    console.log(`Failed: ${totalTests - totalPassed}`);
    console.log(`Pass Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
    console.log('\n✅ Results logged to Opik. Check your dashboards!');
    console.log(`   Experiment ID: ${experimentId}`);

  } catch (error) {
    console.error('\n❌ Experiment failed:', error);
    process.exit(1);
  }
}

main();
