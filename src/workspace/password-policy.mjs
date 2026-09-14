export const passwordRequirements = 'Mínimo 8 caracteres, un número, una letra mayúscula, una minúscula y un símbolo especial, como un punto (.).';

export function validNewPassword(value) {
  return typeof value === 'string' && value.length >= 8 && /[0-9]/.test(value)
    && /[a-z]/.test(value) && /[A-Z]/.test(value) && /[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/.test(value);
}
