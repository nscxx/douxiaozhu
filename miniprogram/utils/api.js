const app = getApp();

function request(method, url, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: app.globalData.baseUrl + url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        Authorization: app.globalData.token ? 'Bearer ' + app.globalData.token : ''
      },
      success(res) {
        const body = res.data || {};
        if (res.statusCode === 401) {
          wx.removeStorageSync('dxz_token');
          wx.redirectTo({ url: '/pages/login/login' });
          reject(new Error('请重新登录'));
          return;
        }
        if (body.code !== 0) {
          reject(new Error(body.msg || '请求失败'));
          return;
        }
        resolve(body.data);
      },
      fail(err) { reject(err); }
    });
  });
}

module.exports = {
  login: (username, password) => request('POST', '/api/auth/login', { username, password }),
  me: () => request('GET', '/api/auth/me'),
  tasks: (tab) => request('GET', '/api/worker/tasks?tab=' + tab + '&page_size=50'),
  stats: () => request('GET', '/api/worker/stats'),
  claim: (id) => request('POST', '/api/contents/' + id + '/claim'),
  submitCredential: (id, payload) => request('POST', '/api/contents/' + id + '/credential', payload)
};
