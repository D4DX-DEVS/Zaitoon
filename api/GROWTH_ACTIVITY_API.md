# Growth Activity API Documentation

## Overview

The Growth Activity API manages user reading streaks, book completion tracking, and achievements. **All endpoints are public and do not require authentication tokens.** User identification is done via Firebase UID.

**Base URL**: `http://localhost:5000/api/activity`

---

## Authentication

**No authentication required** - All endpoints are public. User identification is done via `firebaseUid` parameter.

---

## GET Endpoints

### 1. Get Aggregate Statistics

**Endpoint**: `GET /api/activity/stats`

**Description**: Returns aggregate statistics for all users (total streaks, books read, achievements, active users).

**Authentication**: None required

**Query Parameters**: None

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalCurrentStreaks": 5,
    "totalBooksRead": 9,
    "totalAchievements": 5,
    "activeStreakUsers": 4
  }
}
```

**Example**:
```bash
curl http://localhost:5000/api/activity/stats
```

---

### 2. Get User Activity

**Endpoint**: `GET /api/activity/me`

**Description**: Returns activity data for a specific user identified by Firebase UID. **Automatically creates a new user if they don't exist yet** with default values (all zeros for streaks, books, and achievements).

**Authentication**: None required

**Query Parameters**:
- `firebaseUid` (required) - Firebase UID of the user

**Response** (200 OK):

**Existing User**:
```json
{
  "success": true,
  "data": {
    "userId": "ZvjLIT8FKicaoieQLgFDuBaZs5q2",
    "email": "user@example.com",
    "displayName": "User Name",
    "readingStreak": 1,
    "booksRead": 6,
    "achievements": 3,
    "lastActive": "2026-02-12T14:19:04.012Z"
  }
}
```

**New User** (auto-created):
```json
{
  "success": true,
  "data": {
    "userId": "new_firebase_uid_123",
    "email": "new_firebase_uid_123@firebase.local",
    "displayName": "New User",
    "readingStreak": 0,
    "booksRead": 0,
    "achievements": 0,
    "lastActive": null
  }
}
```

**Error Responses**:
- `400 Bad Request` - Missing firebaseUid:
  ```json
  {
    "success": false,
    "message": "firebaseUid is required as query parameter."
  }
  ```

**Example**:
```bash
curl "http://localhost:5000/api/activity/me?firebaseUid=ZvjLIT8FKicaoieQLgFDuBaZs5q2"
```

**Notes**:
- ✅ **Auto-Creation**: If a user doesn't exist, they are automatically created with default values:
  - `name`: "New User" (can be updated later)
  - `email`: `${firebaseUid}@firebase.local` (placeholder)
  - `class`: "Default"
  - `growthActivity`: All zeros (streak: 0, books: 0, achievements: 0)
- This ensures seamless onboarding for first-time users - no 404 errors!
- The endpoint always returns `200 OK` (unless firebaseUid is missing)

---

### 3. Get Users Activity

**Endpoint**: `GET /api/activity/users`

**Description**: Returns activity data. If `firebaseUid` is provided, returns single user activity. Otherwise, returns all users' activity.

**Authentication**: None required

**Query Parameters**:
- `firebaseUid` (optional) - Firebase UID of the user

**Response** (200 OK):

**With firebaseUid** (single user):
```json
{
  "success": true,
  "data": {
    "userId": "ZvjLIT8FKicaoieQLgFDuBaZs5q2",
    "email": "user@example.com",
    "displayName": "User Name",
    "readingStreak": 1,
    "booksRead": 6,
    "achievements": 3,
    "lastActive": "2026-02-12T14:19:04.012Z"
  }
}
```

**Without firebaseUid** (all users):
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "698dde41c1896a1c9887d9f8",
        "name": "Test User",
        "email": "user@example.com",
        "class": "Default",
        "createdAt": "2026-02-12T14:05:53.458Z",
        "readingStreak": {
          "current": 1,
          "longest": 1,
          "lastActiveDate": "2026-02-12T14:19:04.012Z"
        },
        "booksRead": 6,
        "achievements": [
          {
            "achievementId": "first_book",
            "unlockedAt": "2026-02-12T14:19:04.098Z",
            "_id": "698de1586d38e8d71b35671b"
          }
        ],
        "lastActive": "2026-02-12T14:19:04.012Z"
      }
    ]
  }
}
```

**Error Responses**:
- `404 Not Found` - User not found (when firebaseUid provided):
  ```json
  {
    "success": false,
    "message": "User not found."
  }
  ```

**Examples**:
```bash
# Get single user
curl "http://localhost:5000/api/activity/users?firebaseUid=ZvjLIT8FKicaoieQLgFDuBaZs5q2"

# Get all users
curl "http://localhost:5000/api/activity/users"
```

---

## POST Endpoints

### 4. Update Reading Streak

**Endpoint**: `POST /api/activity/update-streak`

**Description**: Updates the daily reading streak for a user. Automatically checks and awards achievements based on streak milestones.

**Authentication**: None required

**Request Body**:
```json
{
  "firebaseUid": "ZvjLIT8FKicaoieQLgFDuBaZs5q2"
}
```

**Request Body Fields**:
- `firebaseUid` (required, string) - Firebase UID of the user

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Streak updated.",
  "data": {
    "readingStreak": {
      "current": 1,
      "longest": 1,
      "lastActiveDate": "2026-02-12T14:19:04.012Z"
    },
    "booksRead": 6,
    "achievements": [
      {
        "achievementId": "first_book",
        "unlockedAt": "2026-02-12T14:19:04.098Z",
        "_id": "698de1586d38e8d71b35671b"
      },
      {
        "achievementId": "speed_reader",
        "unlockedAt": "2026-02-12T14:19:04.265Z",
        "_id": "698de1586d38e8d71b356727"
      }
    ],
    "newlyUnlocked": []
  }
}
```

**Error Responses**:
- `400 Bad Request` - Missing firebaseUid:
  ```json
  {
    "success": false,
    "message": "firebaseUid is required."
  }
  ```
- `404 Not Found` - User not found:
  ```json
  {
    "success": false,
    "message": "User not found."
  }
  ```

**Example**:
```bash
curl -X POST http://localhost:5000/api/activity/update-streak \
  -H "Content-Type: application/json" \
  -d '{"firebaseUid": "ZvjLIT8FKicaoieQLgFDuBaZs5q2"}'
```

**Notes**:
- Streak logic: If last active date was yesterday, increment streak. If it was today, no change. Otherwise, reset to 1.
- Automatically checks and awards achievements after streak update.
- `newlyUnlocked` array contains achievements unlocked in this request.

---

### 5. Complete Book

**Endpoint**: `POST /api/activity/complete-book`

**Description**: Marks a book as completed for a user. Increments books read count, adds to completed books list, and automatically checks for achievements.

**Authentication**: None required

**Request Body**:
```json
{
  "firebaseUid": "ZvjLIT8FKicaoieQLgFDuBaZs5q2",
  "bookId": "book-123",
  "bookType": "story"
}
```

**Request Body Fields**:
- `firebaseUid` (required, string) - Firebase UID of the user
- `bookId` (optional, string) - ID of the completed book
- `bookType` (required, string) - Type of book. Must be one of: `"story"`, `"single_story"`, `"brightbox"`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Book completed.",
  "data": {
    "readingStreak": {
      "current": 1,
      "longest": 1,
      "lastActiveDate": "2026-02-12T14:19:04.012Z"
    },
    "booksRead": 7,
    "achievements": [
      {
        "achievementId": "first_book",
        "unlockedAt": "2026-02-12T14:19:04.098Z",
        "_id": "698de1586d38e8d71b35671b"
      },
      {
        "achievementId": "speed_reader",
        "unlockedAt": "2026-02-12T14:19:04.265Z",
        "_id": "698de1586d38e8d71b356727"
      },
      {
        "achievementId": "bookworm",
        "unlockedAt": "2026-02-12T14:40:17.414Z",
        "_id": "698de6518c1a4cba2848a797"
      }
    ],
    "newlyUnlocked": [
      {
        "achievementId": "bookworm",
        "name": "Bookworm",
        "description": "Complete 5 books",
        "icon": "📚"
      }
    ]
  }
}
```

**Error Responses**:
- `400 Bad Request` - Missing firebaseUid:
  ```json
  {
    "success": false,
    "message": "firebaseUid is required."
  }
  ```
- `400 Bad Request` - Invalid or missing bookType:
  ```json
  {
    "success": false,
    "message": "bookType is required and must be one of: story, single_story, brightbox"
  }
  ```
- `404 Not Found` - User not found:
  ```json
  {
    "success": false,
    "message": "User not found."
  }
  ```

**Example**:
```bash
curl -X POST http://localhost:5000/api/activity/complete-book \
  -H "Content-Type: application/json" \
  -d '{
    "firebaseUid": "ZvjLIT8FKicaoieQLgFDuBaZs5q2",
    "bookId": "book-123",
    "bookType": "story"
  }'
```

**Notes**:
- Automatically increments `booksRead` count.
- Adds book to `completedBooks` array with timestamp.
- Automatically checks and awards achievements based on books read milestones.
- `newlyUnlocked` array contains achievements unlocked in this request.

---

## DELETE Endpoints

### 6. Reset User Growth Activity (Admin Only)

**Endpoint**: `DELETE /api/activity/:firebaseUid`

**Description**: Resets a user's growth activity data to default values (all zeros). This endpoint requires admin authentication.

**Authentication**: Admin token required (Bearer token in Authorization header)

**URL Parameters**:
- `firebaseUid` (required) - Firebase UID or MongoDB _id of the user

**Response** (200 OK):
```json
{
  "success": true,
  "message": "User growth activity reset successfully.",
  "data": {
    "userId": "ZvjLIT8FKicaoieQLgFDuBaZs5q2",
    "email": "user@example.com",
    "displayName": "User Name",
    "growthActivity": {
      "readingStreak": {
        "current": 0,
        "longest": 0,
        "lastActiveDate": null
      },
      "booksRead": 0,
      "achievements": [],
      "completedBooks": [],
      "hadStreakBeforeReset": false
    }
  }
}
```

**Error Responses**:
- `400 Bad Request` - Missing user identifier:
  ```json
  {
    "success": false,
    "message": "User identifier is required."
  }
  ```
- `401 Unauthorized` - Missing or invalid admin token:
  ```json
  {
    "success": false,
    "message": "Unauthorized. Admin access required."
  }
  ```
- `404 Not Found` - User not found:
  ```json
  {
    "success": false,
    "message": "User not found."
  }
  ```

**Example**:
```bash
curl -X DELETE http://localhost:5000/api/activity/ZvjLIT8FKicaoieQLgFDuBaZs5q2 \
  -H "Authorization: Bearer <admin_token>"
```

**Notes**:
- This endpoint supports both Firebase UID and MongoDB ObjectId as the identifier.
- All growth activity data is reset to default values (zeros and empty arrays).
- Requires admin authentication token in the Authorization header.

---

## Test Endpoints

⚠️ **Note**: These endpoints are for testing only. Remove in production.

### 7. Test: Get User by Firebase UID

**Endpoint**: `GET /api/activity/test/user/:firebaseUid`

**Description**: Returns detailed user activity data including full achievement objects.

**Example**:
```bash
curl http://localhost:5000/api/activity/test/user/ZvjLIT8FKicaoieQLgFDuBaZs5q2
```

---

### 8. Test: Update Streak

**Endpoint**: `POST /api/activity/test/update-streak`

**Request Body**:
```json
{
  "firebaseUid": "ZvjLIT8FKicaoieQLgFDuBaZs5q2"
}
```

---

### 9. Test: Complete Book

**Endpoint**: `POST /api/activity/test/complete-book`

**Request Body**:
```json
{
  "firebaseUid": "ZvjLIT8FKicaoieQLgFDuBaZs5q2",
  "bookId": "book-123",
  "bookType": "story"
}
```

---

## Response Data Structures

### User Activity Response
```typescript
{
  userId: string;              // Firebase UID or MongoDB _id
  email: string;               // User email
  displayName: string;         // User name
  readingStreak: number;       // Current reading streak
  booksRead: number;           // Total books completed
  achievements: number;         // Number of achievements unlocked
  lastActive: string | null;   // ISO date string of last activity
}
```

### Detailed Activity Response
```typescript
{
  readingStreak: {
    current: number;           // Current streak count
    longest: number;           // Longest streak ever achieved
    lastActiveDate: string | null;  // ISO date string
  };
  booksRead: number;           // Total books completed
  achievements: Array<{
    achievementId: string;     // Achievement identifier
    unlockedAt: string;        // ISO date string
    _id: string;              // MongoDB document ID
  }>;
  newlyUnlocked: Array<{
    achievementId: string;
    name: string;
    description: string;
    icon: string;
  }>;                          // Achievements unlocked in this request
}
```

### Stats Response
```typescript
{
  totalCurrentStreaks: number;    // Sum of all current streaks
  totalBooksRead: number;         // Sum of all books read
  totalAchievements: number;      // Sum of all achievements
  activeStreakUsers: number;      // Count of users with active streaks
}
```

---

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "message": "Error message describing what went wrong",
  "error": "Detailed error message (in development mode only)"
}
```

**Common HTTP Status Codes**:
- `200` - Success
- `400` - Bad Request (missing or invalid parameters)
- `404` - Not Found (user not found - only for POST endpoints like update-streak and complete-book)
- `500` - Internal Server Error

**Note**: The `GET /api/activity/me` endpoint no longer returns 404 errors. It automatically creates users if they don't exist, ensuring seamless onboarding.

---

## Flutter Integration Example

```dart
// Get user activity (auto-creates user if first time)
final response = await http.get(
  Uri.parse('http://localhost:5000/api/activity/me?firebaseUid=$firebaseUid')
);

if (response.statusCode == 200) {
  final data = jsonDecode(response.body);
  if (data['success']) {
    final activity = data['data'];
    print('Reading Streak: ${activity['readingStreak']}');
    print('Books Read: ${activity['booksRead']}');
    print('Achievements: ${activity['achievements']}');
    // User is automatically created if this is their first time!
  }
}

// Update streak
final streakResponse = await http.post(
  Uri.parse('http://localhost:5000/api/activity/update-streak'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({'firebaseUid': firebaseUid}),
);

// Complete book
final bookResponse = await http.post(
  Uri.parse('http://localhost:5000/api/activity/complete-book'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'firebaseUid': firebaseUid,
    'bookId': bookId,
    'bookType': 'story',
  }),
);
```

**Important**: The `GET /api/activity/me` endpoint will always return `200 OK` for valid requests (with or without existing user). No need to handle 404 errors for first-time users!

---

## Notes

1. **No Authentication**: All endpoints are public. User identification is done via `firebaseUid`.

2. **Auto-Create Users**: The `GET /api/activity/me` endpoint automatically creates users when they don't exist, ensuring seamless onboarding for first-time users. No more 404 errors!

3. **Achievement System**: Achievements are automatically checked and awarded when:
   - Streak is updated
   - Book is completed

4. **Streak Logic**:
   - If last active was yesterday → increment streak
   - If last active was today → no change
   - Otherwise → reset to 1

5. **Book Types**: Valid book types are:
   - `"story"` - Regular story
   - `"single_story"` - Single story
   - `"brightbox"` - Brightbox content

6. **Data Persistence**: All activity data is stored in MongoDB and persists across sessions.

7. **User Creation**: When a new user is auto-created via `GET /api/activity/me`:
   - Default `name`: "New User" (can be updated later via profile update)
   - Default `email`: `${firebaseUid}@firebase.local` (placeholder, required field)
   - Default `class`: "Default"
   - All activity stats start at zero

---

## Last Updated

**Date**: February 13, 2026  
**Version**: 1.2  
**Status**: All endpoints tested and working ✅  
**Changes**: 
- Added auto-create functionality to `GET /api/activity/me` endpoint
- Added `DELETE /api/activity/:firebaseUid` admin endpoint documentation
