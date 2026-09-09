const api = require('../../utils/api');
const app = getApp();

Page({
  data: { id: 0, url: '', imagePath: '' },
  onLoad(q) { this.setData({ id: Number(q.id) }); },
  onUrl(e) { this.setData({ url: e.detail.value }); },
  chooseImg() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        const file = res.tempFiles[0];
        wx.uploadFile({
          url: app.globalData.baseUrl + '/api/upload',
          filePath: file.tempFilePath,
          name: 'file',
          header: { Authorization: 'Bearer ' + app.globalData.token },
          success: (up) => {
            const body = JSON.parse(up.data || '{}');
            if (body.code === 0) this.setData({ imagePath: body.data.path });
            else wx.showToast({ title: body.msg || '上传失败', icon: 'none' });
          }
        });
      }
    });
  },
  async submit() {
    try {
      await api.submitCredential(this.data.id, {
        published_url: this.data.url,
        image_path: this.data.imagePath
      });
      wx.showToast({ title: '已提交' });
      wx.switchTab({ url: '/pages/mine/mine' });
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    }
  }
});
