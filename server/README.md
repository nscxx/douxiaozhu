# 豆小助后端

Express + SQLite。同时托管管理后台、执行者 H5、上传文件和 REST API。

```bash
npm install
npm start
# http://localhost:3000
```

鉴权：除 `/api/health`、`POST /api/auth/login` 外均需 `Authorization: Bearer <token>`。

角色：`admin` 全权限；`reviewer` 审核与查看；`worker` 仅领取/交凭证。

PM2：`pm2 start ../deploy/ecosystem.config.js`
