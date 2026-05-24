import { DEFAULT_APP_ID, getAppConfig } from '../config/apps.js';

function readAppId(req) {
  const headerValue = req.headers['x-app-id'];
  if (headerValue) {
    return String(headerValue).trim().toLowerCase();
  }

  const bodyValue = req.body?.appId;
  if (bodyValue) {
    return String(bodyValue).trim().toLowerCase();
  }

  return DEFAULT_APP_ID;
}

export function resolveAppContext(req, res, next) {
  const appId = readAppId(req);
  const appConfig = getAppConfig(appId);

  if (!appConfig) {
    return res.status(400).json({
      error: `unknown appId "${appId}". Send X-App-Id header or body.appId.`,
    });
  }

  req.appId = appConfig.id;
  req.appConfig = appConfig;
  return next();
}
