const Joi = require('joi');

const schemas = {
  login: Joi.object({
    username: Joi.string().alphanum().min(3).max(50).required(),
    password: Joi.string().min(1).max(128).required(),
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().min(1).max(128).required(),
    newPassword: Joi.string().min(8).max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({
        'string.pattern.base': 'La nueva contraseña debe tener al menos una mayúscula, una minúscula y un número.',
      }),
  }),

  forgotPassword: Joi.object({
    username: Joi.string().alphanum().min(3).max(50).required(),
  }),

  resetPassword: Joi.object({
    token: Joi.string().hex().length(64).required(),
    newPassword: Joi.string().min(8).max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({
        'string.pattern.base': 'La contraseña debe tener al menos una mayúscula, una minúscula y un número.',
      }),
  }),

  chat: Joi.object({
    message: Joi.string().min(1).max(1000).required(),
    history: Joi.array().items(
      Joi.object({
        role:    Joi.string().valid('user', 'assistant').required(),
        content: Joi.string().max(4000).required(),
      })
    ).max(20).default([]),
  }),
};

function validate(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) return next();

    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const messages = error.details.map(d => d.message);
      return res.status(400).json({ error: 'Datos inválidos', details: messages });
    }
    req.body = value;
    next();
  };
}

module.exports = { validate };
