const { z } = require('zod');
const { USER_ROLES } = require('../config/constants');

const staffRoleSchema = z.enum([USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.COLLABORATOR]);

const userCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  email: z.string().trim().email(),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'La contraseña debe incluir una mayúscula')
    .regex(/[0-9]/, 'La contraseña debe incluir un número'),
  role: staffRoleSchema.default(USER_ROLES.COLLABORATOR),
  active: z.boolean().default(true),
});

const userUpdateSchema = z
  .object({
    fullName: z.string().trim().min(2).max(150).optional(),
    email: z.string().trim().email().optional(),
    role: staffRoleSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debes enviar al menos un campo para actualizar',
  });

module.exports = {
  userCreateSchema,
  userUpdateSchema,
};
