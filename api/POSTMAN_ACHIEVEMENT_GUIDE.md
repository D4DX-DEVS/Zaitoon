# Postman Guide: Testing Achievements in Growth Activity API

## Overview
This guide shows you how to test achievement functionality in Postman for the Zaitoon Growth Activity API.

---

## Base URL
- **Local Development**: `http://localhost:5000`
- **Production**: `https://<your-domain>`

All endpoints are prefixed with `/api/activity`

---

## Step 1: Authentication

### Option A: Admin Authentication (JWT)
**Endpoint**: `POST /api/admin/login`

**Headers**:
```
Content-Type: application/json
```

**Body** (raw JSON):
```json
{
  "username": "admin@zaitoon",
  "password": "zaitoon@admin"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "_id": "...",
    "username": "admin@zaitoon",
    "role": "admin"
  }
}
```

**Save the token** - You'll need it for authenticated requests!

---

### Option B: User Authentication (Firebase)
If you're using Firebase authentication, you'll need to:
1. Get a Firebase ID token from your Flutter app
2. Use it in the `Authorization` header as: `Bearer <firebase-token>`

---

## Step 2: View Current Achievements

### Get Your Own Activity (Including Achievements)
**Endpoint**: `GET /api/activity/me`

**Headers**:
```
Authorization: Bearer <your-token>
Content-Type: application/json
```

**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "user-id-here",
    "email": "user@example.com",
    "displayName": "User Name",
    "readingStreak": 5,
    "booksRead": 10,
    "achievements": 3,  // ← Number of achievements unlocked
    "lastActive": "2025-02-12T00:00:00.000Z"
  }
}
```

---

### Get All Users Activity (Admin Only)
**Endpoint**: `GET /api/activity/users`

**Headers**:
```
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Response**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "user-id",
        "name": "User Name",
        "email": "user@example.com",
        "class": "10A",
        "readingStreak": {
          "current": 5,
          "longest": 7,
          "lastActiveDate": "2025-02-12T00:00:00.000Z"
        },
        "booksRead": 10,
        "achievements": [
          {
            "achievementId": "first_book",
            "unlockedAt": "2025-02-01T00:00:00.000Z"
          },
          {
            "achievementId": "bookworm",
            "unlockedAt": "2025-02-05T00:00:00.000Z"
          }
        ],
        "lastActive": "2025-02-12T00:00:00.000Z"
      }
    ]
  }
}
```

---

### Get Stats (Admin Only)
**Endpoint**: `GET /api/activity/stats`

**Headers**:
```
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Response**:
```json
{
  "success": true,
  "data": {
    "totalCurrentStreaks": 150,
    "totalBooksRead": 500,
    "totalAchievements": 75,  // ← Total achievements across all users
    "activeStreakUsers": 30
  }
}
```

---

## Step 3: Trigger Achievement Checks

Achievements are automatically checked when you:
1. Update a reading streak
2. Complete a book

### Update Reading Streak (Triggers Achievement Check)
**Endpoint**: `POST /api/activity/update-streak`

**Headers**:
```
Authorization: Bearer <your-token>
Content-Type: application/json
```

**Body** (raw JSON):
```json
{
  "userId": "user-id-here"  // Optional: omit if same as token user
}
```

**Response** (if new achievements unlocked):
```json
{
  "success": true,
  "message": "Streak updated.",
  "data": {
    "readingStreak": {
      "current": 3,
      "longest": 3,
      "lastActiveDate": "2025-02-12T00:00:00.000Z"
    },
    "booksRead": 5,
    "achievements": [
      {
        "achievementId": "getting_started",
        "unlockedAt": "2025-02-12T00:00:00.000Z"
      }
    ],
    "newlyUnlocked": [  // ← New achievements just unlocked!
      {
        "achievementId": "getting_started",
        "name": "Getting Started",
        "description": "Maintain a 3-day reading streak",
        "icon": "🔥"
      }
    ]
  }
}
```

---

### Complete a Book (Triggers Achievement Check)
**Endpoint**: `POST /api/activity/complete-book`

**Headers**:
```
Authorization: Bearer <your-token>
Content-Type: application/json
```

**Body** (raw JSON):
```json
{
  "userId": "user-id-here",  // Optional: omit if same as token user
  "bookId": "book-id-here",  // Optional
  "bookType": "story"  // Required: "story" | "single_story" | "brightbox"
}
```

**Response** (if new achievements unlocked):
```json
{
  "success": true,
  "message": "Book completed.",
  "data": {
    "readingStreak": {
      "current": 5,
      "longest": 7,
      "lastActiveDate": "2025-02-12T00:00:00.000Z"
    },
    "booksRead": 6,  // ← Incremented
    "achievements": [
      {
        "achievementId": "first_book",
        "unlockedAt": "2025-02-01T00:00:00.000Z"
      },
      {
        "achievementId": "bookworm",  // ← Newly unlocked!
        "unlockedAt": "2025-02-12T00:00:00.000Z"
      }
    ],
    "newlyUnlocked": [  // ← New achievements just unlocked!
      {
        "achievementId": "bookworm",
        "name": "Bookworm",
        "description": "Read 5 books",
        "icon": "📚"
      }
    ]
  }
}
```

---

## Available Achievements

Based on the code, here are all the achievements you can unlock:

### Reading Milestones (Based on Books Read)

| Achievement ID | Icon | Name | Description | Requirement |
|----------------|------|------|-------------|-------------|
| `first_book` | 📖 | First Book | Complete your first book | `booksRead >= 1` |
| `bookworm` | 🐛 | Bookworm | Complete 5 books | `booksRead >= 5` |
| `reading_master_10` | 📚 | Reading Master (10) | Complete 10 books | `booksRead >= 10` |
| `reading_master_25` | 📚 | Reading Master (25) | Complete 25 books | `booksRead >= 25` |
| `reading_master_50` | 📚 | Reading Master (50) | Complete 50 books | `booksRead >= 50` |
| `reading_master_100` | 📚 | Reading Master (100) | Complete 100 books | `booksRead >= 100` |

### Streak-Based Achievements

| Achievement ID | Icon | Name | Description | Requirement |
|----------------|------|------|-------------|-------------|
| `getting_started` | 🔥 | Getting Started | Maintain a 3-day reading streak | `currentStreak >= 3` |
| `week_warrior` | ⚡ | Week Warrior | Maintain a 7-day reading streak | `currentStreak >= 7` |
| `monthly_master` | 🌟 | Monthly Master | Maintain a 30-day reading streak | `currentStreak >= 30` |
| `year_legend` | 👑 | Year Legend | Maintain a 365-day reading streak | `currentStreak >= 365` |

### Special Achievements

| Achievement ID | Icon | Name | Description | Requirement |
|----------------|------|------|-------------|-------------|
| `speed_reader` | ⚡ | Speed Reader | Complete 3 or more books in the last 7 days | `booksCompletedInLast7Days >= 3` |
| `comeback_kid` | 💪 | Comeback Kid | Lost your streak and built it back to 3+ days | `hadStreakBeforeReset && currentStreak >= 3` |

---

## Testing Workflow

### Example: Test "Bookworm" Achievement (5 books)

1. **Login as Admin**:
   ```
   POST /api/admin/login
   ```

2. **Get a User ID** (if you don't have one):
   ```
   GET /api/activity/users
   ```
   Copy a `userId` from the response

3. **Complete 5 Books** (repeat 5 times):
   ```
   POST /api/activity/complete-book
   Body: {
     "userId": "your-user-id",
     "bookId": "book-1",
     "bookType": "story"
   }
   ```
   
   On the 5th completion, you should see `bookworm` in `newlyUnlocked`!

4. **Verify Achievement**:
   ```
   GET /api/activity/me
   ```
   Or if admin:
   ```
   GET /api/activity/users
   ```
   Check the `achievements` array for `bookworm`

---

## Common Issues & Solutions

### Issue: "User ID is required"
**Solution**: Make sure you're either:
- Logged in as the user (token contains userId), OR
- Sending `userId` in the request body (admin only)

### Issue: "Access denied"
**Solution**: 
- Non-admin users can only update their own activity
- Make sure your token is valid and not expired

### Issue: "bookType is required"
**Solution**: Make sure `bookType` is one of:
- `"story"`
- `"single_story"`
- `"brightbox"`

### Issue: No achievements showing
**Solution**:
- Achievements are checked automatically when you update streak or complete a book
- Check the `newlyUnlocked` array in the response
- Use `GET /api/activity/me` or `GET /api/activity/users` to see all unlocked achievements

---

## Postman Collection Setup

### Environment Variables
Create a Postman environment with:
- `base_url`: `http://localhost:5000`
- `admin_token`: (set after login)
- `user_token`: (set after login)
- `user_id`: (set after getting user)

### Pre-request Script (for authenticated endpoints)
```javascript
pm.request.headers.add({
    key: 'Authorization',
    value: 'Bearer ' + pm.environment.get('admin_token')
});
```

---

## Quick Test Checklist

- [ ] Admin login successful
- [ ] Can view own activity (`GET /api/activity/me`)
- [ ] Can update streak (`POST /api/activity/update-streak`)
- [ ] Can complete book (`POST /api/activity/complete-book`)
- [ ] Achievements appear in response (`newlyUnlocked` array)
- [ ] Achievements persist (`GET /api/activity/me` shows them)
- [ ] Admin can view all users' achievements (`GET /api/activity/users`)

---

## Notes

- Achievements are checked **automatically** when you update streak or complete a book
- The `newlyUnlocked` array in responses shows achievements just earned
- Achievements persist in the user's `growthActivity.achievements` array
- Admin can view all users' achievements via `/api/activity/users`
- Regular users can only view their own achievements via `/api/activity/me`
