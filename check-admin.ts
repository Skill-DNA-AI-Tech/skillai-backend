import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkAdmin() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    const adminEmail = process.env.ADMIN_EMAIL;
    const passwordToVerify = process.env.ADMIN_PASSWORD_TO_VERIFY;

    if (!mongoUri || !adminEmail) {
      throw new Error('Set MONGODB_URI and ADMIN_EMAIL before running this script.');
    }

    await mongoose.connect(mongoUri);
    console.log('MongoDB connected');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB database connection is not available.');
    }

    const users = db.collection('users');
    const adminUser = await users.findOne({ email: adminEmail });

    if (!adminUser) {
      console.log(`Admin user ${adminEmail} NOT found`);
      console.log('\nAll users:');
      const allUsers = await users.find({}).toArray();
      allUsers.forEach((user) => console.log(`  - ${user.email} (${user.role})`));
    } else {
      console.log('Admin user found:');
      console.log(`  Email: ${adminUser.email}`);
      console.log(`  Role: ${adminUser.role}`);
      console.log(`  Has password: ${Boolean(adminUser.password)}`);

      if (passwordToVerify) {
        const bcrypt = await import('bcryptjs');
        const correct = await bcrypt.compare(passwordToVerify, adminUser.password);
        console.log(`  Password match for provided verification password: ${correct}`);
      }
    }

    await mongoose.connection.close();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error:', message);
    process.exitCode = 1;
  }
}

checkAdmin();
