import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: required('JWT_SECRET'),
  rpName: process.env.RP_NAME || 'Passkey MVP',
  rpID: required('RP_ID'),
  origin: required('ORIGIN'),
  challengeTtlMs: Number(process.env.CHALLENGE_TTL_MS || 5 * 60 * 1000),
  dataFile: process.env.DATA_FILE || 'src/data/db.json',
};
