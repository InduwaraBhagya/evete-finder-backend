# Event Finder Backend API

Backend API for Event Finder Flutter Application using Express.js and MongoDB

## Prerequisites

- Node.js 14+ 
- MongoDB (Local or MongoDB Atlas)
- npm or yarn

## Installation

### Step 1: Install Dependencies

```bash
cd backend
npm install
```

### Step 2: Configure Environment

Copy `.env` file and update with your settings:

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/event_finder

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d

# Server Configuration
PORT=3000
NODE_ENV=development
```

#### MongoDB Setup Options:

**Option A: Local MongoDB**
```bash
# macOS with Homebrew
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# Windows
# Download: https://www.mongodb.com/try/download/community
# Run installer and MongoDB will start as service

# Linux
sudo apt-get install mongodb
sudo systemctl start mongodb
```

**Option B: MongoDB Atlas (Cloud)**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create free account and cluster
3. Create database user
4. Whitelist IP: 0.0.0.0/0 (allow all)
5. Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/event_finder`

### Step 3: Seed Database

Populate database with test data:

```bash
npm run seed
```

This creates:
- **Admin**: admin@test.com / test123
- **Organizer**: organizer@test.com / test123
- **User**: user@test.com / test123
- **8 Sample Events**

## Running the Server

### Development Mode (with auto-restart)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

Expected output:
```
✅ MongoDB Connected Successfully
🚀 Server running on port 3000
📍 API URL: http://localhost:3000
```

## API Endpoints

### Authentication Routes (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - Login user
- `GET /me` - Get current user (requires auth)
- `PUT /profile` - Update profile (requires auth)
- `POST /logout` - Logout (requires auth)

### Event Routes (`/api/events`)
- `GET /` - Get all events (with filters)
- `GET /featured` - Get featured events
- `GET /:id` - Get single event
- `POST /` - Create event (organizer only)
- `PUT /:id` - Update event (organizer only)
- `DELETE /:id` - Delete event (organizer only)
- `GET /search/query` - Search events

### Booking Routes (`/api/bookings`)
- `GET /` - Get user's bookings (requires auth)
- `GET /:id` - Get single booking (requires auth)
- `POST /` - Create booking (requires auth)
- `PUT /:id/cancel` - Cancel booking (requires auth)
- `GET /organizer/event-bookings` - Get organizer's bookings (requires auth)

### Wishlist Routes (`/api/wishlist`)
- `GET /` - Get user's wishlist (requires auth)
- `POST /` - Add to wishlist (requires auth)
- `DELETE /:id` - Remove from wishlist (requires auth)

### Admin Routes (`/api/admin`)
- `GET /dashboard/stats` - Get dashboard stats (admin only)
- `GET /users/list` - Get all users (admin only)
- `GET /events/list` - Get all events (admin only)
- `PUT /users/:id/deactivate` - Deactivate user (admin only)
- `PUT /events/:id/feature` - Feature event (admin only)

## Testing API Endpoints

### Using cURL

**Register:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@test.com",
    "password": "test123",
    "role": "user"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@test.com",
    "password": "test123"
  }'
```

**Get All Events:**
```bash
curl http://localhost:3000/api/events
```

**Get Events with Filters:**
```bash
curl "http://localhost:3000/api/events?category=Music&sortBy=price_asc&limit=5"
```

### Using Postman

1. Download [Postman](https://www.postman.com/downloads/)
2. Create new requests for each endpoint
3. Use the routes listed above
4. For authenticated endpoints, add header:
   ```
   Authorization: Bearer <your_token_here>
   ```

## Database Schema

### Users Collection
```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  password: String (hashed),
  phone: String,
  profileImage: String,
  role: "user" | "organizer" | "admin",
  bio: String,
  isVerified: Boolean,
  isActive: Boolean,
  preferences: {
    categories: [String],
    notifications: Boolean
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Events Collection
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  category: String,
  date: Date,
  time: String,
  location: String,
  latitude: Number,
  longitude: Number,
  organizer: ObjectId (ref: User),
  organizerName: String,
  images: [String],
  price: Number,
  totalSeats: Number,
  availableSeats: Number,
  isFeatured: Boolean,
  rating: Number,
  reviewCount: Number,
  isActive: Boolean,
  bookings: [ObjectId],
  createdAt: Date,
  updatedAt: Date
}
```

### Bookings Collection
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  event: ObjectId (ref: Event),
  numberOfSeats: Number,
  totalPrice: Number,
  status: "confirmed" | "pending" | "cancelled",
  paymentId: String,
  qrCode: String,
  bookingRef: String (unique),
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Wishlist Collection
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  event: ObjectId (ref: Event),
  createdAt: Date,
  updatedAt: Date
}
```

## Troubleshooting

### MongoDB Connection Error
```
Error: connect ECONNREFUSED
```
**Solution:** 
- Ensure MongoDB is running: `sudo systemctl status mongodb`
- Check MONGODB_URI in .env file

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution:**
- Change PORT in .env file
- Or kill process: `lsof -ti:3000 | xargs kill -9`

### JWT Token Invalid
```
Error: Invalid or expired token
```
**Solution:**
- Ensure JWT_SECRET is set in .env
- Check token hasn't expired
- Include `Bearer` prefix in Authorization header

## Production Deployment

### Deploy to Heroku

```bash
# Create Heroku app
heroku create event-finder-api

# Add MongoDB Atlas URI
heroku config:set MONGODB_URI=mongodb+srv://...

# Deploy
git push heroku main
```

### Deploy to Railway

1. Connect GitHub repo
2. Add MongoDB plugin
3. Set environment variables
4. Deploy

### Deploy to Render

1. Connect GitHub repo
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Add environment variables
5. Deploy

## Security Best Practices

- ✅ Always use strong JWT_SECRET in production
- ✅ Never commit .env file (it's in .gitignore)
- ✅ Use HTTPS in production
- ✅ Implement rate limiting
- ✅ Enable CORS only for your frontend
- ✅ Hash passwords with bcrypt (already implemented)
- ✅ Validate all input data
- ✅ Use environment variables for sensitive data

## License

ISC

## Support

For issues or questions, please create an issue in the repository.
