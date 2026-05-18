const mongoose = require('mongoose');
require('dotenv').config();

async function inspectDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // Get database
    const db = mongoose.connection.db;
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('\n=== Available Collections ===');
    collections.forEach(collection => {
      console.log('- ' + collection.name);
    });
    
    // Inspect users collection
    console.log('\n=== Users Collection Sample ===');
    const usersCollection = db.collection('users');
    const userSample = await usersCollection.findOne();
    if (userSample) {
      console.log('Sample user document:');
      console.log(JSON.stringify(userSample, null, 2));
      
      // Get field names
      const userFields = Object.keys(userSample);
      console.log('\nUser fields:', userFields);
    } else {
      console.log('No users found');
    }
    
    // Inspect challans collection
    console.log('\n=== Challans Collection Sample ===');
    const challansCollection = db.collection('challans');
    const challanSample = await challansCollection.findOne();
    if (challanSample) {
      console.log('Sample challan document:');
      console.log(JSON.stringify(challanSample, null, 2));
      
      // Get field names
      const challanFields = Object.keys(challanSample);
      console.log('\nChallan fields:', challanFields);
    } else {
      console.log('No challans found');
    }

    // Inspect scholarships collection
    console.log('\n=== Scholarships Collection Sample ===');
    const scholarshipsCollection = db.collection('scholarships');
    const scholarshipSample = await scholarshipsCollection.findOne();
    if (scholarshipSample) {
      console.log('Sample scholarship document:');
      console.log(JSON.stringify(scholarshipSample, null, 2));
      
      const scholarshipFields = Object.keys(scholarshipSample);
      console.log('\nScholarship fields:', scholarshipFields);
    } else {
      console.log('No scholarships found');
    }
    
    // Get counts
    const userCount = await usersCollection.countDocuments();
    const challanCount = await challansCollection.countDocuments();
    const scholarshipCount = await scholarshipsCollection.countDocuments();
    
    console.log('\n=== Collection Counts ===');
    console.log(`Total users: ${userCount}`);
    console.log(`Total challans: ${challanCount}`);
    console.log(`Total scholarships: ${scholarshipCount}`);
    
  } catch (error) {
    console.error('Error inspecting database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

inspectDatabase();
