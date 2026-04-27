// ============================================================
// 腾讯云 文本内容安全 API (TextModeration)
// API版本: 2020-12-29, 服务: tms
// 使用 TC3-HMAC-SHA256 签名调用
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface ZhuqueConfig {
  secretId: string;
  secretKey: string;
  bizType: string;
  region?: string;
}

function sha256(message: string): string {
  return crypto.createHash('sha256').update(message).digest('hex');
}

function hmacSha256(key: Buffer | string, message: string): Buffer {
  return crypto.createHmac('sha256', key).update(message).digest();
}

async function callZhuqueAPI(config: ZhuqueConfig, content: string): Promise<{
  aiProbability: number;
  isAIGenerated: boolean;
  decision: string;
  requestId: string;
}> {
  const { secretId, secretKey, bizType, region = 'ap-guangzhou' } = config;

  const service = 'tms';
  const host = 'tms.tencentcloudapi.com';
  const action = 'TextModeration';
  const version = '2020-12-29';
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().split('T')[0];

  const payload = JSON.stringify({
    Content: Buffer.from(content, 'utf-8').toString('base64'),
    BizType: bizType,
    Type: 'TEXT_AIGC',
  });

  // Step 1: 规范请求串
  const contentType = 'application/json; charset=utf-8';
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    sha256(payload),
  ].join('\n');

  // Step 2: 待签名字符串
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256',
    timestamp.toString(),
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n');

  // Step 3: 计算签名
  const secretDate = hmacSha256(`TC3${secretKey}`, date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, 'tc3_request');
  const signature = crypto
    .createHmac('sha256', secretSigning)
    .update(stringToSign)
    .digest('hex');

  // Step 4: Authorization
  const authorization =
    `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  // Step 5: 发送请求
  const res = await fetch(`https://${host}`, {
    method: 'POST',
    headers: {
      'Authorization': authorization,
      'Content-Type': contentType,
      'Host': host,
      'X-TC-Action': action,
      'X-TC-Version': version,
      'X-TC-Timestamp': timestamp.toString(),
      'X-TC-Region': region,
    },
    body: payload,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[detect-ai] HTTP ${res.status}:`, errText.slice(0, 500));
    throw new Error(`朱雀API错误 (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();

  if (data.Response?.Error) {
    console.error(`[detect-ai] API Error:`, JSON.stringify(data.Response.Error));
    throw new Error(`朱雀API错误: ${data.Response.Error.Message || JSON.stringify(data.Response.Error)}`);
  }

  const result = data.Response;

  // TextModeration + TEXT_AIGC 返回:
  // Suggestion: Block/Review/Pass
  // DetailResults[0].Score: AI生成风险分数
  const suggestion = result.Suggestion || 'Pass';
  const detailScore = result.DetailResults?.[0]?.Score;
  const resultScore = result.Score;

  let aiProbability = 0;
  if (detailScore != null && detailScore > 0) {
    aiProbability = Math.round(detailScore > 1 ? detailScore : detailScore * 100);
  } else if (resultScore != null && resultScore > 0) {
    aiProbability = Math.round(resultScore > 1 ? resultScore : resultScore * 100);
  } else {
    if (suggestion === 'Block') aiProbability = 85;
    else if (suggestion === 'Review') aiProbability = 55;
    else aiProbability = 0;
  }

  return {
    aiProbability,
    isAIGenerated: suggestion === 'Block',
    decision: suggestion,
    requestId: result.RequestId ?? '',
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, zhuqueConfig } = body;

    if (!content?.trim()) {
      return NextResponse.json({ success: false, error: '请输入要检测的内容' }, { status: 400 });
    }

    if (!zhuqueConfig?.secretId || !zhuqueConfig?.secretKey) {
      return NextResponse.json(
        { success: false, error: '请先在设置页面配置朱雀API密钥' },
        { status: 400 }
      );
    }

    if (!zhuqueConfig?.bizType) {
      return NextResponse.json(
        { success: false, error: '请先在设置页面配置 BizType（从控制台获取）' },
        { status: 400 }
      );
    }

    // 截断过长文本（AI生成识别单次上限2000字，建议350-2000字）
    const maxLen = 2000;
    const truncated = content.length > maxLen ? content.slice(0, maxLen) : content;

    const result = await callZhuqueAPI({
      secretId: zhuqueConfig.secretId,
      secretKey: zhuqueConfig.secretKey,
      bizType: zhuqueConfig.bizType,
      region: zhuqueConfig.region,
    }, truncated);

    return NextResponse.json({
      success: true,
      ...result,
      truncated: content.length > maxLen,
      originalLength: content.length,
    });
  } catch (error) {
    console.error('AI检测失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '检测失败' },
      { status: 500 }
    );
  }
}
