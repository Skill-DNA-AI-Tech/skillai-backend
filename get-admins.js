const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function getAdmins() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not found");
    return;
  }
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");
  
  const usersCollection = mongoose.connection.db.collection('users');
  const admins = await usersCollection.find({ role: 'admin' }).toArray();
  
  console.log("Admin Users in Database:");
  admins.forEach(admin => {
    console.log(`- Email: ${admin.email}, Name: ${admin.name}, Role: ${admin.role}`);
  });
  
  await mongoose.connection.close();
}

getAdmins();
