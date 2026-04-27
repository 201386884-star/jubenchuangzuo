import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { name, baseUrl, model, apiKey } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ success: false, error: '请填写 API Key' });
    }

    if (!baseUrl) {
      return NextResponse.json({ success: false, error: '请填写接口 URL' });
    }

    // Detect API style by URL pattern
    const isAnthropic = baseUrl.includes('anthropic');
    const isOpenAICompat = baseUrl.includes('openai') || baseUrl.includes('chat/completions') || baseUrl.includes('v1/chat');

    let testUrl = baseUrl;
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let body: string;

    if (isAnthropic) {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      body = JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      });
    } else {
      // OpenAI-compatible (OpenAI, Google via proxy, Ollama, DeepSeek, etc.)
      if (!testUrl.includes('/chat/completions')) {
        testUrl = testUrl.replace(/\/$/, '') + '/chat/completions';
      }
      headers['Authorization'] = `Bearer ${apiKey}`;
      body = JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(testUrl, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({
        success: false,
        error: `HTTP ${response.status}: ${errText.slice(0, 200)}`,
      });
    }

    await response.json();
    return NextResponse.json({ success: true, message: '连接成功' });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    const isTimeout = message.includes('abort') || message.includes('timeout');
    return NextResponse.json({
      success: false,
      error: isTimeout ? '连接超时（15秒）' : message,
    });
  }
}
