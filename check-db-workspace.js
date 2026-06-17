const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function check() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not found");
    return;
  }
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");
  const count = await mongoose.connection.db.collection('questionbanks').countDocuments({});
  console.log("QuestionBank count:", count);
  const activeCount = await mongoose.connection.db.collection('questionbanks').countDocuments({ status: 'Active' });
  console.log("Active QuestionBank count:", activeCount);
  const hrCount = await mongoose.connection.db.collection('questionbanks').countDocuments({ interviewType: 'HR' });
  console.log("HR QuestionBank count:", hrCount);
  const byType = await mongoose.connection.db.collection('questionbanks').aggregate([
    { $group: { _id: '$interviewType', count: { $sum: 1 } } }
  ]).toArray();
  console.log("By type:", byType);
  await mongoose.connection.close();
}

check();
