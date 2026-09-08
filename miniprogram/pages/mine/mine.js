const api = require('../../utils/api');
const app = getApp();

Page({
  data: { items: [], stats: {} },
  onShow() {
    if (!app.globalData.token) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.load();
  },
  async load() {
    const [stats, data] = await Promise.all([api.stats(), api.tasks('done')]);
    this.setData({ items: data.items || [], stats });
  }
});
