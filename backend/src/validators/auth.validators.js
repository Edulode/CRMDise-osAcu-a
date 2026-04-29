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
  twoFactorCode: z.string().trim().regex(/^[0-9]{6}$/, 'El código 2FA debe tener 6 dígitos').optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es obligatoria'),
  newPassword: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'La nueva contraseña debe incluir una mayúscula')
    .regex(/[0-9]/, 'La nueva contraseña debe incluir un número'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'El refresh token es obligatorio'),
});

const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

const passwordResetConfirmSchema = z.object({
  token: z.string().min(1, 'El token es obligatorio'),
  newPassword: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'La nueva contraseña debe incluir una mayúscula')
    .regex(/[0-9]/, 'La nueva contraseña debe incluir un número'),
});

const twoFactorVerifySchema = z.object({
  code: z.string().trim().regex(/^[0-9]{6}$/, 'El código 2FA debe tener 6 dígitos'),
});

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  refreshTokenSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  twoFactorVerifySchema,
};
