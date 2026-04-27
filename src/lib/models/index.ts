// ============================================================
// 模型统一接口
// ============================================================

import type { ModelProvider } from '@/types';

// 模型配置
interface ModelConfig {
  provider: ModelProvider;
  modelName: string;
  apiKey?: string;
  baseUrl?: string;
}

// 统一的聊天请求
interface ChatRequest {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  maxTokens?: number;
}

// 统一的聊天响应
interface ChatResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// 模型配置
const MODEL_CONFIGS: Record<ModelProvider, { defaultModel: string; apiStyle: 'anthropic' | 'openai' }> = {
  anthropic: {
    defaultModel: 'claude-sonnet-4-20250514',
    apiStyle: 'anthropic',
  },
  openai: {
    defaultModel: 'gpt-4o-mini',
    apiStyle: 'openai',
  },
  google: {
    defaultModel: 'gemini-2.0-flash',
    apiStyle: 'openai',
  },
  ollama: {
    defaultModel: 'qwen2.5',
    apiStyle: 'openai',
  },
};

// 获取模型列表
export function getAvailableModels(): { provider: ModelProvider; models: { id: string; name: string }[] }[] {
  return [
    {
      provider: 'anthropic',
      models: [
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
        { id: 'claude-3-opus-4-20250514', name: 'Claude 3 Opus' },
      ],
    },
    {
      provider: 'openai',
      models: [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      ],
    },
    {
      provider: 'google',
      models: [
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      ],
    },
    {
      provider: 'ollama',
      models: [
        { id: 'qwen2.5', name: 'Qwen 2.5' },
        { id: 'llama3', name: 'Llama 3' },
        { id: 'deepseek-v2', name: 'DeepSeek V2' },
      ],
    },
  ];
}

// 获取默认模型
export function getDefaultModel(provider: ModelProvider): string {
  return MODEL_CONFIGS[provider]?.defaultModel || 'claude-sonnet-4-20250514';
}

// 获取提供商显示名称
export function getProviderDisplayName(provider: ModelProvider): string {
  const names: Record<ModelProvider, string> = {
    anthropic: 'Anthropic Claude',
    openai: 'OpenAI GPT',
    google: 'Google Gemini',
    ollama: '本地 Ollama',
  };
  return names[provider] || provider;
}

// 聊天请求函数
export async function chat(
  config: ModelConfig,
  request: ChatRequest
): Promise<ChatResponse> {
  const { provider, modelName, apiKey, baseUrl } = config;
  const model = modelName || MODEL_CONFIGS[provider]?.defaultModel;

  switch (provider) {
    case 'anthropic':
      return chatWithAnthropic({ apiKey, model, ...request });
    case 'openai':
      return chatWithOpenAI({ apiKey, model, baseUrl, ...request });
    case 'google':
      return chatWithGoogle({ apiKey, model, baseUrl, ...request });
    case 'ollama':
      return chatWithOllama({ baseUrl: baseUrl || 'http://localhost:11434', model, ...request });
    default:
      throw new Error(`不支持的模型提供商: ${provider}`);
  }
}

// Anthropic Claude API
async function chatWithAnthropic({
  apiKey,
  model,
  messages,
  temperature = 0.8,
  maxTokens = 4096,
}: {
  apiKey?: string;
  model: string;
  messages: ChatRequest['messages'];
  temperature?: number;
  maxTokens?: number;
}): Promise<ChatResponse> {
  if (!apiKey) {
    throw new Error('缺少 Anthropic API Key');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API 错误: ${error}`);
  }

  const data = await response.json();
  return {
    content: data.content[0]?.text || '',
    usage: {
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    },
  };
}

// OpenAI API
async function chatWithOpenAI({
  apiKey,
  model,
  baseUrl = 'https://api.openai.com/v1',
  messages,
  temperature = 0.8,
  maxTokens = 4096,
}: {
  apiKey?: string;
  model: string;
  baseUrl?: string;
  messages: ChatRequest['messages'];
  temperature?: number;
  maxTokens?: number;
}): Promise<ChatResponse> {
  if (!apiKey) {
    throw new Error('缺少 OpenAI API Key');
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API 错误: ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || '',
    usage: {
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    },
  };
}

// Google Gemini API
async function chatWithGoogle({
  apiKey,
  model,
  baseUrl,
  messages,
  temperature = 0.8,
  maxTokens = 4096,
}: {
  apiKey?: string;
  model: string;
  baseUrl?: string;
  messages: ChatRequest['messages'];
  temperature?: number;
  maxTokens?: number;
}): Promise<ChatResponse> {
  if (!apiKey) {
    throw new Error('缺少 Google API Key');
  }

  // 转换消息格式
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google API 错误: ${error}`);
  }

  const data = await response.json();
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
  };
}

// Ollama 本地模型
async function chatWithOllama({
  baseUrl,
  model,
  messages,
  temperature = 0.8,
  maxTokens = 4096,
}: {
  baseUrl: string;
  model: string;
  messages: ChatRequest['messages'];
  temperature?: number;
  maxTokens?: number;
}): Promise<ChatResponse> {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      num_predict: maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama API 错误: ${error}`);
  }

  const data = await response.json();
  return {
    content: data.message?.content || '',
  };
}

// 流式聊天请求
export async function* streamChat(
  config: ModelConfig,
  request: ChatRequest
): AsyncGenerator<string, void, unknown> {
  const { provider, modelName, apiKey, baseUrl } = config;
  const model = modelName || MODEL_CONFIGS[provider]?.defaultModel;

  switch (provider) {
    case 'anthropic':
      // Anthropic 支持流式
      if (!apiKey) throw new Error('缺少 API Key');
      const response1 = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: request.temperature || 0.8,
          max_tokens: request.maxTokens || 4096,
          stream: true,
        }),
      });

      if (!response1.ok) throw new Error(`API 错误: ${response1.status}`);
      const reader1 = response1.body?.getReader();
      if (!reader1) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      let eventBuffer = '';

      while (true) {
        const { done, value } = await reader1.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            try {
              const json = JSON.parse(data);
              if (json.content_block?.text) {
                yield json.content_block.text;
              }
            } catch {}
          }
        }
      }
      break;

    case 'openai':
    case 'google':
      // OpenAI/Google 流式处理
      const apiUrl = provider === 'openai'
        ? `${baseUrl || 'https://api.openai.com/v1'}/chat/completions`
        : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (provider === 'openai') {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const body = provider === 'openai'
        ? { model, messages: request.messages, temperature: request.temperature, stream: true, max_tokens: request.maxTokens }
        : { contents: request.messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), generationConfig: { temperature: request.temperature, maxOutputTokens: request.maxTokens } };

      const response2 = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response2.ok) throw new Error(`API 错误: ${response2.status}`);
      const reader2 = response2.body?.getReader();
      if (!reader2) throw new Error('无法读取响应流');

      const decoder2 = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: streamDone } = await reader2.read();
        done = streamDone;
        if (value) {
          const chunk = decoder2.decode(value, { stream: true });
          // 解析SSE
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') { done = true; break; }
              try {
                const json = JSON.parse(data);
                const text = provider === 'openai'
                  ? json.choices?.[0]?.delta?.content
                  : json.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) yield text;
              } catch {}
            }
          }
        }
      }
      break;

    default:
      throw new Error(`不支持的模型提供商: ${provider}`);
  }
}