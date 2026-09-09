App({
  globalData: {
    baseUrl: 'https://your-domain.example.com',
    token: '',
    user: null
  },
  onLaunch() {
    this.globalData.token = wx.getStorageSync('dxz_token') || '';
  }
});
