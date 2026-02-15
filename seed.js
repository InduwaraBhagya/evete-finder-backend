const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Event = require('./models/Event');

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Event.deleteMany({});
    console.log('Cleared existing data');

    // Create test users
    const hashedPassword = await bcrypt.hash('test123', 10);

    const users = await User.create([
      {
        name: 'Admin User',
        email: 'admin@test.com',
        password: hashedPassword,
        role: 'admin',
        isVerified: true,
        isActive: true,
      },
      {
        name: 'Event Organizer',
        email: 'organizer@test.com',
        password: hashedPassword,
        role: 'organizer',
        phone: '+94771234567',
        isVerified: true,
        isActive: true,
      },
      {
        name: 'Regular User',
        email: 'user@test.com',
        password: hashedPassword,
        role: 'user',
        phone: '+94771234568',
        isVerified: true,
        isActive: true,
      },
    ]);

    console.log(`✅ Created ${users.length} test users`);

    // Create test events
    const events = await Event.create([
      {
        title: 'Tech Conference 2024',
        description: 'Join us for an amazing tech conference featuring industry experts discussing latest innovations in technology.',
        category: 'Technology',
        date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        time: '09:00',
        location: 'Convention Center, New York',
        latitude: 40.7128,
        longitude: -74.006,
        organizer: users[1]._id,
        organizerName: users[1].name,
        price: 50,
        totalSeats: 500,
        availableSeats: 500,
        images: ['https://via.placeholder.com/400x300?text=Tech+Conference'],
        isFeatured: true,
        rating: 4.5,
        reviewCount: 50,
        isActive: true,
      },
      {
        title: 'Music Festival 2024',
        description: 'Experience unforgettable performances from international and local music artists.',
        category: 'Music',
        date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        time: '18:00',
        location: 'Central Park, New York',
        latitude: 40.785,
        longitude: -73.968,
        organizer: users[1]._id,
        organizerName: users[1].name,
        price: 75,
        totalSeats: 1000,
        availableSeats: 850,
        images: ['https://via.placeholder.com/400x300?text=Music+Festival'],
        isFeatured: true,
        rating: 4.8,
        reviewCount: 120,
        isActive: true,
      },
      {
        title: 'Sports Marathon 2024',
        description: 'Join thousands of runners for an exciting 10K marathon through the city.',
        category: 'Sports',
        date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        time: '07:00',
        location: 'Downtown District',
        latitude: 40.758,
        longitude: -73.985,
        organizer: users[1]._id,
        organizerName: users[1].name,
        price: 30,
        totalSeats: 2000,
        availableSeats: 1500,
        images: ['https://via.placeholder.com/400x300?text=Sports+Marathon'],
        isFeatured: false,
        rating: 4.2,
        reviewCount: 80,
        isActive: true,
      },
      {
        title: 'Art Exhibition Opening',
        description: 'Contemporary art exhibition featuring works from renowned local and international artists.',
        category: 'Art',
        date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        time: '19:00',
        location: 'Modern Art Museum',
        latitude: 40.761,
        longitude: -73.978,
        organizer: users[1]._id,
        organizerName: users[1].name,
        price: 25,
        totalSeats: 300,
        availableSeats: 280,
        images: ['https://via.placeholder.com/400x300?text=Art+Exhibition'],
        isFeatured: false,
        rating: 4.6,
        reviewCount: 45,
        isActive: true,
      },
      {
        title: 'Food & Wine Festival',
        description: 'Taste delicious cuisines from top chefs and enjoy premium wines from around the world.',
        category: 'Food',
        date: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
        time: '17:00',
        location: 'Riverside Venue',
        latitude: 40.765,
        longitude: -73.976,
        organizer: users[1]._id,
        organizerName: users[1].name,
        price: 120,
        totalSeats: 400,
        availableSeats: 350,
        images: ['https://via.placeholder.com/400x300?text=Food+Festival'],
        isFeatured: true,
        rating: 4.9,
        reviewCount: 200,
        isActive: true,
      },
      {
        title: 'Business Networking Summit',
        description: 'Connect with entrepreneurs and business leaders to discuss growth opportunities and partnerships.',
        category: 'Business',
        date: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        time: '14:00',
        location: 'Business Tower, Suite 2000',
        latitude: 40.753,
        longitude: -73.977,
        organizer: users[1]._id,
        organizerName: users[1].name,
        price: 200,
        totalSeats: 250,
        availableSeats: 150,
        images: ['https://via.placeholder.com/400x300?text=Business+Summit'],
        isFeatured: false,
        rating: 4.4,
        reviewCount: 60,
        isActive: true,
      },
      {
        title: 'Comedy Show Night',
        description: 'Laugh out loud with performances from award-winning comedians.',
        category: 'Entertainment',
        date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        time: '20:00',
        location: 'Comedy Theater',
        latitude: 40.761,
        longitude: -73.973,
        organizer: users[1]._id,
        organizerName: users[1].name,
        price: 60,
        totalSeats: 400,
        availableSeats: 300,
        images: ['https://via.placeholder.com/400x300?text=Comedy+Show'],
        isFeatured: false,
        rating: 4.7,
        reviewCount: 90,
        isActive: true,
      },
      {
        title: 'Photography Workshop',
        description: 'Learn professional photography techniques from expert photographers in a hands-on workshop.',
        category: 'Technology',
        date: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
        time: '10:00',
        location: 'Creative Studio',
        latitude: 40.755,
        longitude: -73.999,
        organizer: users[1]._id,
        organizerName: users[1].name,
        price: 150,
        totalSeats: 30,
        availableSeats: 20,
        images: ['https://via.placeholder.com/400x300?text=Photography+Workshop'],
        isFeatured: false,
        rating: 4.8,
        reviewCount: 35,
        isActive: true,
      },
    ]);

    console.log(`✅ Created ${events.length} test events`);

    console.log('\n📋 Test Accounts Created:');
    console.log('==========================');
    console.log('\n👨‍💼 Admin Account:');
    console.log('Email: admin@test.com');
    console.log('Password: test123');
    console.log('Role: Admin\n');

    console.log('🎪 Organizer Account:');
    console.log('Email: organizer@test.com');
    console.log('Password: test123');
    console.log('Role: Event Organizer\n');

    console.log('👤 User Account:');
    console.log('Email: user@test.com');
    console.log('Password: test123');
    console.log('Role: Regular User\n');

    console.log('==========================');
    console.log(`✅ Database seeded successfully!`);
    console.log(`📊 Total Users: ${users.length}`);
    console.log(`📊 Total Events: ${events.length}`);

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

// Run seeding
seedDatabase();
