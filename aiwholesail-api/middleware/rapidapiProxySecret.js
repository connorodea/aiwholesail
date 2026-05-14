function rapidapiProxySecret(req, res, next) {
  const provided =
    req.get('x-rapidapi-proxy-secret') || req.get('X-RapidAPI-Proxy-Secret');
  if (!provided) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing proxy secret',
    });
  }
  next();
}

module.exports = { rapidapiProxySecret };
