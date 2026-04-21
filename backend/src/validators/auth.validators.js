const { z } = require('zod');

const emailSchema = z.string().trim().email('Ingresa un correo válido');

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'El nombre es obligatorio'),
  email: emailSchema,
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  phone: z.string().trim().max(20).optional(),
  eventType: z.string().trim().max(80).optional(),
  consent: z.boolean().default(true),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

module.exports = {
  registerSchema,
  loginSchema,
};
