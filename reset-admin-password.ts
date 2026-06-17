import mongoose from 'mongoose';
import User from './src/models/user';

async function resetAdminPassword() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    const adminEmail = process.env.ADMIN_EMAIL;
    const newPassword = process.env.ADMIN_NEW_PASSWORD;

    if (!mongoUri || !adminEmail || !newPassword) {
      throw new Error('Set MONGODB_URI, ADMIN_EMAIL, and ADMIN_NEW_PASSWORD before running this script.');
    }

    await mongoose.connect(mongoUri);
    console.log('MongoDB connected');

    const user = await User.findOne({ email: adminEmail });
    if (!user) {
      throw new Error(`Admin user ${adminEmail} not found`);
    }

    user.password = newPassword;
    await user.save();

    const bcrypt = await import('bcryptjs');
    const match = await bcrypt.compare(newPassword, user.password || '');
    console.log(`Admin password reset. Verified password hash match: ${match}`);
    await mongoose.connection.close();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error:', message);
    process.exitCode = 1;
  }
}

resetAdminPassword();
