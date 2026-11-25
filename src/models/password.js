import bcrypt from 'bcryptjs';

// Custo baixo em teste para a suíte não ficar lenta.
const COST = process.env.NODE_ENV === 'test' ? 4 : 12;

function hash(password) {
  return bcrypt.hash(password, COST);
}

function compare(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

const password = { hash, compare };

export default password;
