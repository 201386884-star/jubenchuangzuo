// ============================================================
// 根据 API 配置统一调用 AI 接口（服务端使用）
// ============================================================

interface ChatOptions {
  baseUrl: string;
  model: string;
  apiKey: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  maxTokens?: number;
}

interface ChatResult {
  content: string;
  usage?: { inputTokens: number; outputTokens: number };
}

async function callApi(opts: ChatOptions, useTemperature: boolean): Promise<ChatResult> {
  const { baseUrl, model, apiKey, messages, temperature = 0.8, maxTokens = 4096 } = opts;
  const isAnthropic = baseUrl.includes('anthropic');

  if (isAnthropic) {
    const body: Record<string, any> = { model, messages, max_tokens: maxTokens };
    if (useTemperature) body.temperature = temperature;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API 错误 (${res.status}): ${err.slice(0, 300)}`);
    }
    const data = await res.json();
    return {
      content: data.content?.[0]?.text || '',
      usage: { inputTokens: data.usage?.input_tokens || 0, outputTokens: data.usage?.output_tokens || 0 },
    };
  }

  // OpenAI-compatible
  let url = baseUrl;
  if (!url.includes('/chat/completions')) {
    url = url.replace(/\/$/, '') + '/chat/completions';
  }

  const body: Record<string, any> = { model, messages, max_tokens: maxTokens };
  if (useTemperature) body.temperature = temperature;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API 错误 (${res.status}): ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: { inputTokens: data.usage?.prompt_tokens || 0, outputTokens: data.usage?.completion_tokens || 0 },
  };
}

export async function chatWithConfig(opts: ChatOptions): Promise<ChatResult> {
  try {
    return await callApi(opts, true);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    // 如果是 temperature 参数导致的错误，去掉 temperature 重试
    if (msg.includes('temperature')) {
      return await callApi(opts, false);
    }
    throw err;
  }
}

// ============================================================
// 流式输出版本 —— 逐 token 推送
// ============================================================

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullContent: string) => void;
  onError: (err: Error) => void;
}

/**
 * 流式调用 LLM，每收到一个 token 就回调 onToken
 * 支持 OpenAI-compatible 和 Anthropic 两种 API
 */
export async function chatStream(
  opts: ChatOptions,
  callbacks: StreamCallbacks,
): Promise<void> {
  const { baseUrl, model, apiKey, messages, temperature = 0.85, maxTokens = 4096 } = opts;
  const isAnthropic = baseUrl.includes('anthropic');

  try {
    if (isAnthropic) {
      await streamAnthropic({ model, apiKey, messages, temperature, maxTokens }, callbacks);
    } else {
      await streamOpenAI({ baseUrl, model, apiKey, messages, temperature, maxTokens }, callbacks);
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('temperature')) {
      // 重试不带 temperature
      try {
        if (isAnthropic) {
          await streamAnthropic({ model, apiKey, messages, maxTokens }, callbacks);
        } else {
          await streamOpenAI({ baseUrl, model, apiKey, messages, maxTokens }, callbacks);
        }
      } catch (retryErr) {
        callbacks.onError(retryErr instanceof Error ? retryErr : new Error('流式调用失败'));
      }
    } else {
      callbacks.onError(err instanceof Error ? err : new Error('流式调用失败'));
    }
  }
}

async function streamOpenAI(
  opts: { baseUrl: string; model: string; apiKey: string; messages: any[]; temperature?: number; maxTokens: number },
  callbacks: StreamCallbacks,
) {
  let url = opts.baseUrl;
  if (!url.includes('/chat/completions')) {
    url = url.replace(/\/$/, '') + '/chat/completions';
  }

  const body: Record<string, any> = {
    model: opts.model,
    messages: opts.messages,
    max_tokens: opts.maxTokens,
    stream: true,
  };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API 错误 (${res.status}): ${err.slice(0, 300)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('无法获取响应流');

  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      // 处理 buffer 中剩余的数据
      if (buffer.trim()) {
        const remaining = buffer.split('\n');
        for (const line of remaining) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              callbacks.onToken(delta);
            }
          } catch { /* skip */ }
        }
      }
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') continue;

      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          callbacks.onToken(delta);
        }
      } catch { /* skip malformed chunks */ }
    }
  }

  callbacks.onDone(fullContent);
}

async function streamAnthropic(
  opts: { model: string; apiKey: string; messages: any[]; temperature?: number; maxTokens: number },
  callbacks: StreamCallbacks,
) {
  const body: Record<string, any> = {
    model: opts.model,
    messages: opts.messages,
    max_tokens: opts.maxTokens,
    stream: true,
  };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API 错误 (${res.status}): ${err.slice(0, 300)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('无法获取响应流');

  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      // 处理 buffer 中剩余的数据
      if (buffer.trim()) {
        const remaining = buffer.split('\n');
        for (const line of remaining) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          try {
            const json = JSON.parse(data);
            if (json.type === 'content_block_delta') {
              const text = json.delta?.text;
              if (text) {
                fullContent += text;
                callbacks.onToken(text);
              }
            }
          } catch { /* skip */ }
        }
      }
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);

      try {
        const json = JSON.parse(data);
        if (json.type === 'content_block_delta') {
          const text = json.delta?.text;
          if (text) {
            fullContent += text;
            callbacks.onToken(text);
          }
        }
      } catch { /* skip */ }
    }
  }

  callbacks.onDone(fullContent);
}
