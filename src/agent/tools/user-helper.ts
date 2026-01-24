import { sql } from '@/lib/db';

// Helper to get or create user
// For now using email as identifier (userId passed from chat)
export async function getOrCreateUser(userId: string = 'default_user') {
  const existingUser = await sql`SELECT * FROM users WHERE email = ${userId}`;
  if (existingUser.length > 0) {
    return existingUser[0];
  }

  // Create new user
  const newUser = await sql`
    INSERT INTO users (email, name)
    VALUES (${userId}, 'Health User')
    RETURNING *
  `;
  return newUser[0];
}
