/**
 * Centralized Express Error Handler
 */
function errorHandler(err, req, res, next) {
    console.error('[SafeHer Error]', err.stack || err.message);

    const statusCode = err.status || 500;
    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        success: false,
        error: message,
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
}

/**
 * 404 Route Not Found Handler
 */
function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        message: `Endpoint ${req.method} ${req.originalUrl} not found.`
    });
}

module.exports = {
    errorHandler,
    notFoundHandler
};
