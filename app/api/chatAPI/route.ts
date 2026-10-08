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
  const totalStartTime = Date.now();

  try {
    // 1. TAHAP AUTH & VALIDASI
    if (!OPENROUTER_API_KEY) {
      return new NextResponse('OPENROUTER_API_KEY is missing', { status: 500 });
    }

    const body = await req.json();
    const { messages, model, stream = false, provider } = body;

    if (!messages) {
      return new NextResponse('Missing messages', { status: 400 });
    }
    
    const authLatency = Date.now() - totalStartTime;
    const llmStartTime = Date.now();

    let targetModel = modelMap[provider] || model || 'google/gemini-2.5-flash';
    if (model && model.includes('/')) {
      targetModel = model;
    }

    const alignedMessages = applySystemPromptLayer(messages);
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin || (host ? `${proto}://${host}` : '');

    // 2. TAHAP LLM INFERENCE
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

    const llmLatency = Date.now() - llmStartTime;

    if (!openRouterResponse.ok || !openRouterResponse.body) {
      const errText = await openRouterResponse.text();
      return new NextResponse(`OpenRouter Error: ${errText}`, { status: openRouterResponse.status });
    }

    // 3. TAHAP POD WRITE (Simulasi/Placeholder)
    // 💡 REKOMENDASI: Pindahkan logika saveMessageToSolidPod dari page.tsx ke sini.
    // Jika dipindahkan, tambahkan kode ini:
    // const podWriteStart = Date.now();
    // await saveMessageToSolidPod(body.sessionId, assistantMessage); 
    // const podWriteLatency = Date.now() - podWriteStart;
    const podWriteLatency = 0; // Ganti dengan nilai aktual jika logika dipindah ke backend

    // Siapkan Header untuk k6 Load Test
    const responseHeaders = new Headers();
    responseHeaders.set('X-Timing-Auth', authLatency.toString());
    responseHeaders.set('X-Timing-LLM', llmLatency.toString());
    responseHeaders.set('X-Timing-PodWrite', podWriteLatency.toString());
    responseHeaders.set('X-Timing-Total', (Date.now() - totalStartTime).toString());

    if (stream) {
      responseHeaders.set('Content-Type', 'text/event-stream');
      responseHeaders.set('Cache-Control', 'no-cache');
      responseHeaders.set('Connection', 'keep-alive');
      return new NextResponse(openRouterResponse.body, { status: 200, headers: responseHeaders });
    } else {
      responseHeaders.set('Content-Type', 'application/json');
      const data = await openRouterResponse.json();
      return NextResponse.json(data, { headers: responseHeaders });
    }

  } catch (err: any) {
    return new NextResponse(`Internal Error: ${err.message}`, { status: 500 });
  }
}