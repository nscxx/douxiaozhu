function parseJson(value, fallback) {
  try {
    return JSON.parse(value == null ? '' : value);
  } catch {
    return fallback;
  }
}

function paginate(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(500, Math.max(1, parseInt(query.page_size, 10) || 50));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function ok(res, data = {}, msg = 'success') {
  return res.json({ code: 0, data, msg });
}

function fail(res, code, msg, httpStatus = 200) {
  return res.status(httpStatus).json({ code, msg, data: null });
}

function parseTags(item) {
  if (!item) return item;
  if (item.a_tags !== undefined) item.a_tags = parseJson(item.a_tags, []);
  if (item.b_tags !== undefined) item.b_tags = parseJson(item.b_tags, []);
  if (item.tags !== undefined) item.tags = parseJson(item.tags, []);
  if (item.content_types !== undefined) item.content_types = parseJson(item.content_types, []);
  if (item.time_slots !== undefined) item.time_slots = parseJson(item.time_slots, []);
  return item;
}

module.exports = { parseJson, paginate, ok, fail, parseTags };
