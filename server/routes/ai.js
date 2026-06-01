const express = require('express');
const router = express.Router();

// AI内容生成（占位，后续接入火山引擎API）
router.post('/generate', async (req, res) => {
  const { movie_name, account_name, content_type, movie_info, prompt } = req.body;
  
  // TODO: 接入火山引擎大模型API
  // 当前返回占位响应
  res.json({
    code: 0,
    data: {
      content: `[AI生成占位] ${content_type || '内容'} - ${movie_name || '电影'}`,
      status: '待接入AI',
      message: 'AI内容生成功能待接入火山引擎API，请在配置中设置API Key后使用'
    }
  });
});

// 批量AI内容生成
router.post('/batch-generate', async (req, res) => {
  const { tasks } = req.body;
  
  // TODO: 批量调用AI生成
  res.json({
    code: 0,
    data: {
      results: [],
      message: '批量AI生成功能待接入火山引擎API'
    }
  });
});

module.exports = router;
