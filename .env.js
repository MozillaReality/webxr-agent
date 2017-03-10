exports = {
  PM2_ENV_WEBHOOK_SECRET: 'U!!rvGoe12LJgkQ19gwx8nX1dsKegjw==uK',
  STEAM_WEB_API_KEY: '3896DEB69B30A29148EFA7E77D600A95'
};

Object.keys(exports).forEach(key => {
  process.env[key] = exports[key];
});
