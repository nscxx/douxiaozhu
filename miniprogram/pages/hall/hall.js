const api = require('../../utils/api');
const app = getApp();

Page({
  data: { items: [], tab: 'claimable' },
  onShow() {
    if (!app.globalData.token) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.load();
  },
  async load() {
    const data = await api.tasks(this.data.tab);
    this.setData({ items: data.items || [] });
  },
  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
    this.load();
  },
  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id + '&tab=' + this.data.tab });
  }
});
