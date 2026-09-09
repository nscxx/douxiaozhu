const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { ok, fail } = require('../db-utils');

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const okType = /image\/(jpeg|png|webp|gif)/.test(file.mimetype);
    cb(okType ? null : new Error('只支持 jpg/png/webp 图片'), okType);
  }
});

const router = express.Router();
router.post('/', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return fail(res, 400, err.message || '上传失败');
    if (!req.file) return fail(res, 400, '请选择图片');
    const rel = `/uploads/${req.file.filename}`;
    return ok(res, { path: rel, url: rel, filename: req.file.filename });
  });
});

module.exports = router;
