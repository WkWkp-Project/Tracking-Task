export class HttpError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(code, message, details) {
  return new HttpError(400, code, message, details);
}

export function forbidden(message = 'You do not have permission to perform this action') {
  return new HttpError(403, 'FORBIDDEN', message);
}

export function notFound(resource = 'Resource') {
  return new HttpError(404, 'NOT_FOUND', `${resource} not found`);
}

export function conflict(code, message) {
  return new HttpError(409, code, message);
}

export function assertPlainObject(value, label = 'request body') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest('INVALID_BODY', `${label} must be a JSON object`);
  }
  return value;
}

export function cleanString(value, field, { required = false, max = 5000 } = {}) {
  if (value === undefined || value === null) {
    if (required) throw badRequest('VALIDATION_ERROR', `${field} is required`, { field });
    return undefined;
  }
  if (typeof value !== 'string') {
    throw badRequest('VALIDATION_ERROR', `${field} must be a string`, { field });
  }
  const cleaned = value.trim();
  if (required && !cleaned) {
    throw badRequest('VALIDATION_ERROR', `${field} is required`, { field });
  }
  if (cleaned.length > max) {
    throw badRequest('VALIDATION_ERROR', `${field} must be at most ${max} characters`, { field });
  }
  return cleaned;
}

export function dateString(value, field, { required = false, nullable = false } = {}) {
  if ((value === null || value === '') && nullable) return null;
  const cleaned = cleanString(value, field, { required, max: 10 });
  if (cleaned === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    throw badRequest('VALIDATION_ERROR', `${field} must use YYYY-MM-DD`, { field });
  }
  const parsed = new Date(`${cleaned}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== cleaned) {
    throw badRequest('VALIDATION_ERROR', `${field} is not a valid date`, { field });
  }
  return cleaned;
}

export function finiteNumber(
  value,
  field,
  { required = false, min = -Infinity, max = Infinity } = {}
) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest('VALIDATION_ERROR', `${field} is required`, { field });
    return undefined;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw badRequest(
      'VALIDATION_ERROR',
      `${field} must be a number between ${min} and ${max}`,
      { field }
    );
  }
  return number;
}

export function enumValue(value, field, allowed, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest('VALIDATION_ERROR', `${field} is required`, { field });
    return undefined;
  }
  if (!allowed.includes(value)) {
    throw badRequest('VALIDATION_ERROR', `${field} is invalid`, { field, allowed });
  }
  return value;
}

export function assertDateRange(startDate, endDate) {
  if (startDate && endDate && startDate > endDate) {
    throw badRequest('INVALID_DATE_RANGE', 'startDate must be on or before endDate');
  }
}

// Express 4 does not forward rejected route promises to error middleware.
// Keep every async route behind this adapter so thrown HttpErrors become a
// normal 4xx/5xx response instead of an unhandled rejection that can stop Node.
export function asyncRoute(handler) {
  return function asyncRouteHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof SyntaxError && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Request body contains invalid JSON',
      code: 'INVALID_JSON',
    });
  }
  const status = Number(err.status) || 500;
  if (status >= 500) console.error('[error]', err);
  return res.status(status).json({
    error: status >= 500 ? 'Internal server error' : err.message,
    code: status >= 500 ? 'INTERNAL_ERROR' : err.code || 'REQUEST_ERROR',
    ...(err.details ? { details: err.details } : {}),
  });
}
