const api = require('../../utils/api');

Page({
  data: { item: null, id: 0, tab: 'claimable' },
  async onLoad(q) {
    this.setData({ id: Number(q.id), tab: q.tab || 'claimable' });
    const data = await api.tasks(q.tab || 'claimable');
    const item = (data.items || []).find((x) => x.id === Number(q.id));
    this.setData({ item });
  },
  copy() {
    if (!this.data.item) return;
    wx.setClipboardData({ data: this.data.item.content || '' });
  },
  async claim() {
    try {
      await api.claim(this.data.id);
      wx.showToast({ title: '领取成功' });
      wx.navigateTo({ url: '/pages/submit/submit?id=' + this.data.id });
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },
  goSubmit() {
    wx.navigateTo({ url: '/pages/submit/submit?id=' + this.data.id });
  }
});
