const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

async function resetAdmins() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not found");
    return;
  }
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");
  
  const usersCollection = mongoose.connection.db.collection('users');
  const admins = await usersCollection.find({ role: 'admin' }).toArray();
  
  if (admins.length === 0) {
    console.log("No admin users found in the database. Creating one...");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    await usersCollection.insertOne({
      name: 'SkillDNA Admin',
      email: 'admin@skilldna.com',
      password: hashedPassword,
      role: 'admin',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log("Created admin user: admin@skilldna.com with password 'admin123'");
  } else {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    
    for (const admin of admins) {
      await usersCollection.updateOne(
        { _id: admin._id },
        { $set: { password: hashedPassword } }
      );
      console.log(`Reset password for admin ${admin.email} to 'admin123'`);
    }
  }
  
  await mongoose.connection.close();
}

resetAdmins();
