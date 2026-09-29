import { NextRequest, NextResponse } from 'next/server';
import { applySystemPromptLayer } from '@/utils/systemPromptLayer';

export const runtime = 'edge';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

const modelMap: Record<string, string> = {
  openai: 'openai/gpt-4o',
  deepseek: 'deepseek/deepseek-chat',
  llama: 'meta-llama/llama-3.3-70b-instruct',
  llama33: 'meta-llama/llama-3.3-70b-instruct',
  kimi: 'moonshotai/kimi-k2',
  qwen: 'qwen/qwen-2.5-72b-instruct',
  gemini: 'google/gemini-2.5-flash',
};

export async function POST(req: NextRequest) {
  try {
    if (!OPENROUTER_API_KEY) {
      return new NextResponse('OPENROUTER_API_KEY is missing in environment variables.', {
        status: 500,
      });
    }

    const body = await req.json();
    const { messages, model, stream = false, provider } = body;

    if (!messages) {
      return new NextResponse('Missing messages', { status: 400 });
    }
    let targetModel = modelMap[provider] || model || 'google/gemini-2.5-flash';
    if (model && model.includes('/')) {
      targetModel = model;
    }

    const alignedMessages = applySystemPromptLayer(messages);
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      origin ||
      (host ? `${proto}://${host}` : '');

    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': siteUrl,
        'X-Title': 'Decentralized GenAI Summarized',
      },
      body: JSON.stringify({
        model: targetModel,
        messages: alignedMessages,
        stream,
        max_tokens: 2048,
      }),
    });

    if (!openRouterResponse.ok || !openRouterResponse.body) {
      const errText = await openRouterResponse.text();
      return new NextResponse(`OpenRouter Error (${openRouterResponse.status}): ${errText}`, {
        status: openRouterResponse.status,
      });
    }

    if (stream) {
      return new NextResponse(openRouterResponse.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      const data = await openRouterResponse.json();
      return NextResponse.json(data);
    }
  } catch (err: any) {
    return new NextResponse(`Internal Error: ${err.message}`, { status: 500 });
  }
}