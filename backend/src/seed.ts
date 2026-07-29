import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

import User from './Models/User';

dotenv.config();

/**
 * Creates the demo CampusRent users directly in MongoDB Atlas.
 *
 * Admin:
 * admin@mycentennialcollege.ca
 * admin123
 *
 * Student:
 * maria@mycentennialcollege.ca
 * student123
 */
async function seedDatabase(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error(
      'MONGODB_URI is missing. Add it to backend/.env.'
    );
  }

  try {
    console.log('Connecting to MongoDB Atlas...');

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log(
      `Connected to MongoDB database: ${mongoose.connection.name}`
    );

    /*
     * Create or update the administrator account.
     */
    const adminPasswordHash = await bcrypt.hash(
      'admin123',
      10
    );

    await User.findOneAndUpdate(
      {
        email: 'admin@mycentennialcollege.ca',
      },
      {
        email: 'admin@mycentennialcollege.ca',
        password_hash: adminPasswordHash,
        first_name: 'Campus',
        last_name: 'Admin',
        phone: '',
        bio: 'CampusRent administrator account.',
        role: 'admin',
        verification_status: 'verified',
        status: 'active',
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    console.log(
      'Created or updated admin: admin@mycentennialcollege.ca / admin123'
    );

    /*
     * Create or update the demo student account.
     */
    const studentPasswordHash = await bcrypt.hash(
      'student123',
      10
    );

    await User.findOneAndUpdate(
      {
        email: 'maria@mycentennialcollege.ca',
      },
      {
        email: 'maria@mycentennialcollege.ca',
        password_hash: studentPasswordHash,
        first_name: 'Maria',
        last_name: 'Santos',
        phone: '416-555-0101',
        bio: 'CS student who loves sharing textbooks and lab gear.',
        role: 'student',
        verification_status: 'verified',
        status: 'active',
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    console.log(
      'Created or updated student: maria@mycentennialcollege.ca / student123'
    );

    console.log('MongoDB user seed completed successfully.');
  } catch (error) {
    console.error('MongoDB seed failed.');

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

void seedDatabase();