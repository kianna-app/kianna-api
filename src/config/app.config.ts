export default () => ({
  port: parseInt(process.env.PORT || '3333', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3333',
});
