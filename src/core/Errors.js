'use strict';

class AppError extends Error {
  constructor(message, { status = 500, code = 'INTERNAL_ERROR', details = null } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(message = 'Datos inválidos', details = null) {
    super(message, { status: 400, code: 'VALIDATION_ERROR', details });
  }
}

class AuthError extends AppError {
  constructor(message = 'No autenticado') {
    super(message, { status: 401, code: 'AUTH_ERROR' });
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'No tiene permiso para ejecutar esta acción') {
    super(message, { status: 403, code: 'FORBIDDEN' });
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(message, { status: 404, code: 'NOT_FOUND' });
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflicto con un registro existente', details = null) {
    super(message, { status: 409, code: 'CONFLICT', details });
  }
}

class BusinessRuleError extends AppError {
  constructor(message = 'Regla de negocio incumplida', details = null) {
    super(message, { status: 422, code: 'BUSINESS_RULE_ERROR', details });
  }
}

function okResponse(data = null, message = 'Operación exitosa') {
  return {
    ok: true,
    code: 'OK',
    message,
    data,
  };
}

function translateError(err) {
  if (err instanceof AppError) {
    const body = { ok: false, code: err.code, message: err.message };
    if (err.details) body.details = err.details;
    return { status: err.status, body };
  }

  switch (err && err.code) {
    case '23505':
      return {
        status: 409,
        body: { ok: false, code: 'CONFLICT', message: 'Ya existe un registro con esos datos únicos' },
      };
    case '23503':
      return {
        status: 409,
        body: { ok: false, code: 'CONFLICT', message: 'Referencia inválida o registro asociado a otros datos' },
      };
    case '23514':
      return {
        status: 400,
        body: { ok: false, code: 'VALIDATION_ERROR', message: 'Los valores incumplen las restricciones permitidas' },
      };
    case '23P01':
      return {
        status: 409,
        body: { ok: false, code: 'CONFLICT', message: 'El rango de fechas se solapa con otro registro vigente' },
      };
    case '22P02':
      return {
        status: 400,
        body: { ok: false, code: 'VALIDATION_ERROR', message: 'Formato de dato inválido para la base de datos' },
      };
    default:
      return {
        status: 500,
        body: { ok: false, code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
      };
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  okResponse,
  translateError,
};
