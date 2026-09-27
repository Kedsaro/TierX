import type { SQLiteDatabase } from 'expo-sqlite';
import { userRepository } from '../database/repositories';
import { hashPassword } from '../auth/passwordHash';

/**
 * Utility function to clean up test users from the database
 * This is useful for development and testing purposes
 */
export async function cleanupTestUsers(db: SQLiteDatabase): Promise<{ deleted: number; users: any[] }> {
  try {
    // Get all users
    const users = await userRepository.list(db);
    
    let deletedCount = 0;
    const deletedUsers: any[] = [];
    
    // Delete all users (be careful with this in production!)
    for (const user of users) {
      await userRepository.delete(db, user.id);
      deletedCount++;
      deletedUsers.push({
        id: user.id,
        username: user.username,
        email: user.email,
      });
    }
    
    console.log(`Deleted ${deletedCount} test users:`);
    deletedUsers.forEach(user => {
      console.log(`  - ${user.username} (${user.email})`);
    });
    
    return { deleted: deletedCount, users: deletedUsers };
  } catch (error) {
    console.error('Error cleaning up test users:', error);
    throw error;
  }
}

/**
 * Delete a specific user by login (username or email)
 */
export async function deleteUserByLogin(db: SQLiteDatabase, login: string): Promise<boolean> {
  try {
    const user = await userRepository.getByLogin(db, login);
    if (user) {
      await userRepository.delete(db, user.id);
      console.log(`Deleted user: ${user.username} (${user.email})`);
      return true;
    }
    console.log(`User not found: ${login}`);
    return false;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

/**
 * List all users in the database
 */
export async function listAllUsers(db: SQLiteDatabase): Promise<{ users: any[]; message: string }> {
  try {
    const users = await userRepository.list(db);
    console.log(`Total users in database: ${users.length}`);
    users.forEach(user => {
      console.log(`  - ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Verified: ${user.is_verified ? 'Yes' : 'No'}`);
    });
    
    if (users.length === 0) {
      return { users, message: 'No users in database' };
    }
    
    const userDetails = users.map(user => 
      `• ${user.username} (${user.email}) - ${user.is_verified ? 'Verified' : 'Not verified'}`
    ).join('\n');
    
    return { users, message: `Total users: ${users.length}\n\n${userDetails}` };
  } catch (error) {
    console.error('Error listing users:', error);
    throw error;
  }
}

/**
 * Create a test user automatically for development
 */
export async function createTestUser(db: SQLiteDatabase, email: string): Promise<{ user: any; password: string }> {
  try {
    const testUsername = 'testuser';
    const testPassword = 'TestPassword123';
    const passwordHash = await hashPassword(testPassword);
    
    // Check if user already exists by username or email
    const existingUserByUsername = await userRepository.getByLogin(db, testUsername);
    const existingUserByEmail = await userRepository.getByLogin(db, email);
    
    // Delete existing users if they exist
    if (existingUserByUsername) {
      console.log('Test user with same username already exists, deleting...');
      await userRepository.delete(db, existingUserByUsername.id);
    }
    
    if (existingUserByEmail && existingUserByEmail.id !== existingUserByUsername?.id) {
      console.log('User with same email already exists, deleting...');
      await userRepository.delete(db, existingUserByEmail.id);
    }
    
    // Create new user
    const userId = await userRepository.create(db, {
      username: testUsername,
      email: email,
      password_hash: passwordHash,
      role: 'user',
      terms_accepted: true,
    });
    
    // Verify the user automatically for testing
    await userRepository.setVerified(db, userId);
    
    const user = await userRepository.getById(db, userId);
    if (!user) {
      throw new Error('Failed to retrieve created user');
    }
    
    console.log(`Test user created successfully:`);
    console.log(`  - Username: ${user.username}`);
    console.log(`  - Email: ${user.email}`);
    console.log(`  - Password: ${testPassword}`);
    console.log(`  - Verified: Yes`);
    
    return { user, password: testPassword };
  } catch (error) {
    console.error('Error creating test user:', error);
    throw error;
  }
}