import { NextRequest, NextResponse } from 'next/server';
import { runAllEvals, runActionabilityEval, runPersonalizationEval, runSafetyEval } from '@/lib/evals';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const evalType = searchParams.get('type');

  try {
    let results;

    switch (evalType) {
      case 'actionability':
        results = {
          type: 'actionability',
          ...(await runActionabilityEval()),
        };
        break;
      case 'personalization':
        results = {
          type: 'personalization',
          ...(await runPersonalizationEval()),
        };
        break;
      case 'safety':
        results = {
          type: 'safety',
          ...(await runSafetyEval()),
        };
        break;
      default:
        // Run all evals
        results = await runAllEvals();
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (error) {
    console.error('Error running evals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run evaluations', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, input, output, context } = body;

    // Run a single evaluation on custom input
    if (!type || !output) {
      return NextResponse.json(
        { error: 'type and output are required' },
        { status: 400 }
      );
    }

    let result;

    switch (type) {
      case 'actionability': {
        const { evaluateActionability } = await import('@/lib/evals/actionability');
        result = await evaluateActionability({ input: input || '', output });
        break;
      }
      case 'personalization': {
        const { evaluatePersonalization } = await import('@/lib/evals/personalization');
        result = await evaluatePersonalization({
          context: context || '',
          input: input || '',
          output,
        });
        break;
      }
      case 'safety': {
        const { evaluateSafety } = await import('@/lib/evals/safety');
        result = await evaluateSafety({ input: input || '', output });
        break;
      }
      default:
        return NextResponse.json(
          { error: 'Invalid eval type. Use: actionability, personalization, or safety' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      type,
      ...result,
    });
  } catch (error) {
    console.error('Error running custom eval:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run evaluation', details: String(error) },
      { status: 500 }
    );
  }
}
