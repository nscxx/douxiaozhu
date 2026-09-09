const api = require('../../utils/api');
const app = getApp();

Page({
  data: { username: '', password: '', err: '' },
  onUser(e) { this.setData({ username: e.detail.value }); },
  onPass(e) { this.setData({ password: e.detail.value }); },
  async submit() {
    try {
      const data = await api.login(this.data.username, this.data.password);
      app.globalData.token = data.token;
      app.globalData.user = data.user;
      wx.setStorageSync('dxz_token', data.token);
      wx.switchTab({ url: '/pages/hall/hall' });
    } catch (e) {
      this.setData({ err: e.message });
    }
  }
});
