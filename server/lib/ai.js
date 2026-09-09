const { getSetting } = require('../db');

function personaText(account) {
  const parts = [];
  if (Array.isArray(account.a_tags) && account.a_tags.length) parts.push(`A标签:${account.a_tags.join('/')}`);
  if (Array.isArray(account.b_tags) && account.b_tags.length) parts.push(`B标签:${account.b_tags.join('/')}`);
  if (account.c_tag) parts.push(`C标签:${account.c_tag}`);
  if (account.d_tag) parts.push(`D标签:${account.d_tag}`);
  return parts.join('，') || '普通豆瓣影迷';
}

function fillPrompt(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));
}

function pickPrompt(db, type) {
  if (type.includes('短评')) return getSetting(db, 'prompt_short');
  if (type.includes('讨论') || type.includes('小组')) return getSetting(db, 'prompt_discuss');
  return getSetting(db, 'prompt_review');
}

function mockGenerate({ movie, account, type }) {
  const persona = personaText(account);
  const name = movie.name || '这部作品';
  if (type.includes('短评')) {
    return `看完《${name}》，${persona.includes('严格') ? '有点高估了' : '还是很对味'}。镜头和节奏都在线，适合晚上安静刷。`;
  }
  if (type.includes('讨论') || type.includes('小组')) {
    return `想聊聊《${name}》。导演${movie.director || ''}把${movie.type || '故事'}铺得很满，但人物动机有几处跳。以「${persona}」的口味，我更在意细节是否站得住。你们觉得最大的槽点是结构，还是表演？欢迎讨论，尽量不剧透结局。`;
  }
  return `刚把《${name}》${movie.year ? `（${movie.year}）` : ''}看完。${movie.director ? movie.director + '的' : ''}调度很克制，情绪不是吼出来的，是慢慢渗出来的。作为偏「${persona}」的观众，我会给它${movie.score || '还行'}这个分数附近的观感：有记忆点，也有一点隔。推荐给愿意把字幕看完的人。`;
}

async function volcanoChat({ apiKey, model, messages, imageUrl }) {
  const body = { model, messages };
  if (imageUrl) {
    const last = body.messages[body.messages.length - 1];
    last.content = [
      { type: 'text', text: typeof last.content === 'string' ? last.content : '' },
      { type: 'image_url', image_url: { url: imageUrl } }
    ];
  }
  const res = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`火山引擎请求失败 ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function generateContent(db, { movie, account, type, extraPrompt }) {
  const provider = getSetting(db, 'ai_provider', 'mock');
  const apiKey = process.env.VOLCENGINE_API_KEY || '';
  const template = pickPrompt(db, type || '影评');
  const prompt = fillPrompt(template, {
    movie_name: movie.name || '',
    year: movie.year || '',
    director: movie.director || '',
    type: movie.type || '',
    score: movie.score || '',
    persona: personaText(account)
  }) + (extraPrompt ? `\n补充要求：${extraPrompt}` : '');

  if (provider === 'volcano' && apiKey) {
    const model = getSetting(db, 'volcengine_model', process.env.VOLCENGINE_MODEL || 'doubao-pro-32k');
    const content = await volcanoChat({
      apiKey,
      model,
      messages: [
        { role: 'system', content: '你只输出最终文案，不要前言后语。' },
        { role: 'user', content: prompt }
      ]
    });
    return content.trim();
  }
  return mockGenerate({ movie, account, type });
}

function mockAudit({ content, publishedUrl, hasImage }) {
  const url = publishedUrl || '';
  const isDouban = /douban\.com/i.test(url);
  if (!url) {
    return { ai_status: '不通过', ai_comment: '缺少发布链接', ai_confidence: 0.9 };
  }
  if (!isDouban) {
    return { ai_status: '存疑', ai_comment: '链接不是豆瓣域名，需人工确认', ai_confidence: 0.55 };
  }
  if (!hasImage) {
    return { ai_status: '存疑', ai_comment: '未上传截图，仅凭链接无法确认内容一致性', ai_confidence: 0.6 };
  }
  if (!content) {
    return { ai_status: '存疑', ai_comment: '原生成文案为空，无法比对', ai_confidence: 0.5 };
  }
  return {
    ai_status: '通过',
    ai_comment: '链接为豆瓣域名且已附截图，建议人工抽看截图是否与原文一致',
    ai_confidence: 0.82
  };
}

async function auditCredential(db, payload) {
  const provider = getSetting(db, 'ai_provider', 'mock');
  const apiKey = process.env.VOLCENGINE_API_KEY || '';
  if (provider === 'volcano' && apiKey) {
    const model = getSetting(db, 'volcengine_model', process.env.VOLCENGINE_MODEL || 'doubao-pro-32k');
    const prompt = `你是凭证审核助手。判断执行者是否已把指定文案发布到豆瓣。
待发原文：${payload.content || '（空）'}
发布链接：${payload.publishedUrl || '（空）'}
请只返回 JSON：{"ai_status":"通过|存疑|不通过","ai_comment":"...","ai_confidence":0-1}
规则：链接非豆瓣、无截图、原文对不上则存疑或不通过。不要直接认定高风险通过。`;
    try {
      const raw = await volcanoChat({
        apiKey,
        model,
        messages: [{ role: 'user', content: prompt }],
        imageUrl: payload.imageUrl
      });
      const jsonText = raw.match(/\{[\s\S]*\}/)?.[0];
      const parsed = JSON.parse(jsonText);
      return {
        ai_status: parsed.ai_status || '存疑',
        ai_comment: parsed.ai_comment || raw,
        ai_confidence: Number(parsed.ai_confidence || 0)
      };
    } catch (err) {
      return { ai_status: '存疑', ai_comment: `AI预审失败，转人工：${err.message}`, ai_confidence: 0 };
    }
  }
  return mockAudit(payload);
}

module.exports = { generateContent, auditCredential, personaText };
