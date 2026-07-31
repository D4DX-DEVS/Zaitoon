## Zaitoon API Documentation

### Overview

The Zaitoon API powers stories, quizzes, videos, bright boxes, support payments, and user activity tracking.  
All responses follow a consistent JSON pattern:

- **success**: boolean  
- **message**: human-readable message  
- **data**: main payload (object or array) where applicable

### Base URL

- **Base URL**: `https://<your-domain>` (or `http://localhost:5000` in development)  
- **All endpoints** are prefixed with `/api` (already included in paths below).

### Authentication

- **Admin**: JWT in `Authorization: Bearer <token>` with role `admin`.
- **User**: JWT in `Authorization: Bearer <token>` for user-specific endpoints.
- Some public endpoints do not require authentication and are marked as **Public**.

---

### Common Error Response

```json
{
  "success": false,
  "message": "Error description",
  "errors": {
    "field": "Optional field-specific error message"
  }
}
```

---

## Admin

### POST `/api/admin/login`

- **Description**: Authenticate admin and receive JWT.
- **Auth**: Public
- **Request Body**:

```json
{
  "username": "admin",
  "password": "your_password"
}
```

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "_id": "64f2...",
    "username": "admin",
    "role": "admin"
  }
}
```

---

## Stories

### GET `/api/stories`

- **Description**: List stories (paginated and/or filterable).
- **Auth**: Public
- **Query Params** (optional, inferred):
  - `page`: page number
  - `limit`: page size

- **Success Response (200)**:

```json
{
  "success": true,
  "data": [
    {
      "_id": "64f2...",
      "title": "Story title",
      "description": "Short description",
      "coverImage": "https://.../image.jpg",
      "status": "published",
      "priority": 1
    }
  ]
}
```

### GET `/api/stories/:id`

- **Description**: Get a single story by ID.
- **Auth**: Public
- **URL Params**:
  - `id`: story ID (Mongo ObjectId)

- **Success Response (200)**:

```json
{
  "success": true,
  "data": {
    "_id": "64f2...",
    "title": "Story title",
    "description": "Full description",
    "coverImage": "https://.../image.jpg",
    "status": "published",
    "priority": 1
  }
}
```

### POST `/api/stories`

- **Description**: Create a new story.
- **Auth**: Admin
- **Request Body** (JSON or multipart; fields inferred from code):

```json
{
  "title": "Story title",
  "description": "Short description",
  "mlTitle": "Malayalam title",
  "mlDescription": "Malayalam description",
  "hinTitle": "Hindi title",
  "hinDescription": "Hindi description",
  "urTitle": "Urdu title",
  "urDescription": "Urdu description",
  "tag": "optional tag",
  "status": "published",
  "priority": 1,
  "coverImage": "https://.../image-or-path.jpg"
}
```

- **Success Response (201)**:

```json
{
  "success": true,
  "message": "Story created successfully",
  "data": {
    "_id": "64f2...",
    "title": "Story title",
    "description": "Short description",
    "status": "published",
    "priority": 1,
    "coverImage": "https://.../image-or-path.jpg"
  }
}
```

### PUT `/api/stories/reorder`

- **Description**: Bulk reorder stories via drag-and-drop. Assigns `priority` 1, 2, 3… in the order IDs are provided.
- **Auth**: Admin
- **Request Body**:

```json
{
  "storyIds": ["64f2...", "64f3...", "64f4..."]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `storyIds` | string[] | ✅ | Array of story ObjectIds in the desired display order |

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Stories reordered successfully"
}
```

### PUT `/api/stories/:id`

- **Description**: Update an existing story. Accepts `multipart/form-data` for image replacement or `application/json` for field-only updates.
- **Auth**: Admin
- **Content-Type**: `multipart/form-data` or `application/json`
- **URL Params**:
  - `id`: story ID (MongoDB ObjectId)
- **Request Body** (all fields optional — only provided fields are updated):

| Field | Type | Notes |
|---|---|---|
| `title` | string | English title |
| `description` | string | English description |
| `Tag` | string | Story tag/category label |
| `mlTitle` | string | Malayalam title |
| `mlDescription` | string | Malayalam description |
| `hinTitle` | string | Hindi title |
| `hinDescription` | string | Hindi description |
| `urTitle` | string | Urdu title |
| `urDescription` | string | Urdu description |
| `status` | string | `Active` \| `Inactive` |
| `priority` | number | Display order (1 = first); managed automatically by `/reorder` |
| `coverImage` | file | Replaces existing cover image (multipart) |

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Story updated successfully",
  "data": { "_id": "64f2...", "title": "Updated title" }
}
```

### DELETE `/api/stories/:id`

- **Description**: Delete a story and its cover image from CDN.
- **Auth**: Admin
- **URL Params**:
  - `id`: story ID (MongoDB ObjectId)

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Story deleted successfully"
}
```

### PATCH `/api/stories/:id/status`

- **Description**: Update the status of a story (e.g. draft/published).
- **Auth**: Admin
- **URL Params**:
  - `id`: story ID
- **Request Body**:

```json
{
  "status": "published"
}
```

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Status updated successfully",
  "data": {
    "_id": "64f2...",
    "status": "published"
  }
}
```

---

## Single Stories

### GET `/api/single-stories`

- **Description**: List single stories.
- **Auth**: Public

### GET `/api/single-stories/:id`

- **Description**: Get a single story by ID.
- **Auth**: Public

### GET `/api/single-stories/:id/download-pdf`

- **Description**: Get/download PDF version of the single story (returns a signed URL or file).
- **Auth**: Public

### POST `/api/single-stories`

- **Description**: Create a single story.
- **Auth**: Admin
- **Request Body** (inferred; similar to stories with additional fields for PDF):

```json
{
  "title": "Single story title",
  "description": "Short description",
  "pdfUrl": "https://.../file.pdf",
  "coverImage": "https://.../image.jpg",
  "status": "published"
}
```

---

## Kids Submissions

### GET `/api/kids-submissions`

- **Description**: List all submissions with optional filters and pagination. When `userId` is provided, only `Approved` submissions for that user are returned (no pagination).
- **Auth**: Public
- **Query Params** (all optional):
  - `userId` — filter by user; returns only Approved submissions for that user
  - `status` — `Pending` | `Approved` | `Rejected`
  - `highlight` — `Enable` | `Disable`
  - `page` — page number (default: 1)
  - `limit` — items per page (default: 20)

- **Success Response (200)**:

```json
{
  "success": true,
  "data": [ /* array of submission objects */ ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

### GET `/api/kids-submissions/:id`

- **Description**: Get a single submission by ID.
- **Auth**: Public
- **URL Params**: `id` — MongoDB ObjectId

---

### POST `/api/kids-submissions`

- **Description**: Create a new kids submission. Accepts `multipart/form-data` for file uploads.
- **Auth**: Public (userId required in body)
- **Content-Type**: `multipart/form-data`
- **Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `userId` | string | ✅ | Firebase UID of the submitting user |
| `contentType` | string | ✅ | `story` \| `poem` \| `drawing` \| `letter` \| `other` |
| `title` | string | ✅ | Submission title |
| `kidName` | string | ✅ | Child's name |
| `parentName` | string | ✅ | Parent's full name |
| `phoneNo` | string | ✅ | Parent's WhatsApp number (used for notifications) |
| `storyOrPoem` | string | — | Required for `story` / `poem` / `other` |
| `letter` | string | — | Letter content (used for `letter` type; no character limit) |
| `drawingDescription` | string | — | Required for `drawing` |
| `kidAge` | string | — | Child's age |
| `schoolName` | string | — | School name |
| `moreTitle` | string | — | Additional title |
| `moreDescription` | string | — | Additional description |
| `status` | string | — | `Pending` (default) \| `Approved` \| `Rejected` |
| `highlight` | string | — | `Disable` (default) \| `Enable` |
| `coverImage` | file | — | Cover image upload |
| `drawing` | file | — | Drawing image upload (drawing type) |
| `kidPhoto` | file | — | Child's photo upload |

- **Success Response (201)**:

```json
{
  "success": true,
  "data": { /* created submission object */ }
}
```

---

### PUT `/api/kids-submissions/:id`

- **Description**: Update a submission. Accepts `multipart/form-data` for file updates or `application/json` for field-only updates (e.g. status/highlight changes). **Admin only.**
- **Auth**: Admin (Bearer token)
- **Content-Type**: `multipart/form-data` or `application/json`
- **URL Params**: `id` — MongoDB ObjectId
- **Request Body** (all fields optional — only provided fields are updated):

| Field | Type | Notes |
|---|---|---|
| `contentType` | string | `story` \| `poem` \| `drawing` \| `letter` \| `other` |
| `title` | string | |
| `storyOrPoem` | string | |
| `letter` | string | Letter content (no character limit) |
| `drawingDescription` | string | |
| `kidName` | string | |
| `kidAge` | string | |
| `schoolName` | string | |
| `parentName` | string | |
| `phoneNo` | string | |
| `moreTitle` | string | |
| `moreDescription` | string | |
| `status` | string | `Pending` \| `Approved` \| `Rejected` |
| `highlight` | string | `Enable` \| `Disable` |
| `adminRemarks` | string | Suggestions/feedback for the parent |
| `coverImage` | file | Replaces existing cover image |
| `drawing` | file | Replaces existing drawing |
| `kidPhoto` | file | Replaces existing kid photo |

> **WhatsApp Notifications** — automatically triggered after update:
> - Status changed → `Approved`: parent receives an approval congratulations message.
> - No status change + `adminRemarks` provided: parent receives a suggestions/feedback message.
> - A failed notification never blocks the update response.

- **Success Response (200)**:

```json
{
  "success": true,
  "data": { /* updated submission object */ }
}
```

---

### DELETE `/api/kids-submissions/:id`

- **Description**: Delete a submission and its associated files from CDN.
- **Auth**: Admin (Bearer token)
- **URL Params**: `id` — MongoDB ObjectId

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "KidsSubmission deleted successfully"
}
```

---

## Seasons

> All season routes are mounted under `/api` and use `storyId` and `seasonId`.

### GET `/api/seasons`

- **Description**: List all seasons with basic story info.
- **Auth**: Public

### GET `/api/stories/:storyId/seasons`

- **Description**: List seasons for a specific story.
- **Auth**: Public
- **URL Params**:
  - `storyId`: parent story ID.

### POST `/api/stories/:storyId/seasons`

- **Description**: Create a new season for a story.
- **Auth**: Admin
- **Request Body** (inferred):

```json
{
  "title": "Season title",
  "description": "Optional description",
  "order": 1
}
```

---

## Episodes

> Episodes are nested under both story and season.

### GET `/api/episodes/health`

- **Description**: Health check for episode service.
- **Auth**: Public

### GET `/api/stories/:storyId/seasons/:seasonId/episodes`

- **Description**: List episodes for a season.
- **Auth**: Public

### GET `/api/stories/:storyId/seasons/:seasonId/episodes/:episodeId`

- **Description**: Get single episode.
- **Auth**: Public

### GET `/api/stories/:storyId/seasons/:seasonId/episodes/:episodeId/download-pdf`

- **Description**: Get/download episode PDF.
- **Auth**: Public

### POST `/api/stories/:storyId/seasons/:seasonId/episodes`

- **Description**: Create episode in a season.
- **Auth**: Admin
- **Request Body** (inferred):

```json
{
  "title": "Episode title",
  "description": "Episode content/summary",
  "order": 1,
  "pdfUrl": "https://.../file.pdf"
}
```

### PUT `/api/stories/:storyId/seasons/:seasonId/episodes/reorder`

- **Description**: Reorder episodes in a season.
- **Auth**: Admin

```json
{
  "episodes": [
    { "episodeId": "64f2...", "order": 1 },
    { "episodeId": "64f3...", "order": 2 }
  ]
}
```

---

## Videos & Categories

### GET `/api/videos-categories`

- **Description**: List all video categories, sorted by `priority` ascending.
- **Auth**: Public
- **Query Params** (optional):
  - `page`: page number (default: `1`)
  - `limit`: page size (default: `10`)
  - `status`: filter by status

- **Success Response (200)**:

```json
{
  "success": true,
  "data": {
    "categories": [
      { "_id": "64f2...", "title": "Category name", "image": "https://.../image.jpg", "priority": 0 }
    ],
    "pagination": { "currentPage": 1, "totalPages": 1, "totalCategories": 5 }
  }
}
```

### POST `/api/videos-categories`

- **Description**: Create a video category.
- **Auth**: Admin
- **Content-Type**: `multipart/form-data`
- **Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | ✅ | Category title |
| `image` | file | — | Category cover image |

- **Success Response (201)**:

```json
{
  "success": true,
  "message": "Category created successfully",
  "data": { "_id": "64f2...", "title": "Category name", "priority": 0 }
}
```

### PUT `/api/videos-categories/reorder`

- **Description**: Bulk reorder video categories via drag-and-drop. Assigns `priority` values in the order provided.
- **Auth**: Admin
- **Request Body**:

```json
{
  "order": [
    { "id": "64f2...", "priority": 0 },
    { "id": "64f3...", "priority": 1 },
    { "id": "64f4...", "priority": 2 }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `order` | object[] | ✅ | Array of `{ id, priority }` pairs in the desired display order |

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Categories reordered successfully"
}
```

### PUT `/api/videos-categories/:id`

- **Description**: Update a video category. Old CDN image is deleted on replacement.
- **Auth**: Admin
- **Content-Type**: `multipart/form-data`
- **URL Params**: `id` — MongoDB ObjectId
- **Request Body** (all fields optional):

| Field | Type | Notes |
|---|---|---|
| `title` | string | Category title |
| `image` | file | Replaces existing cover image |

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Video category updated successfully",
  "data": { "_id": "64f2...", "title": "Updated title" }
}
```

### DELETE `/api/videos-categories/:id`

- **Description**: Delete a video category and its image from CDN.
- **Auth**: Admin
- **URL Params**: `id` — MongoDB ObjectId

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Video category deleted successfully"
}
```

### GET `/api/videos`

- **Description**: List videos with optional category filter and pagination.
- **Auth**: Public
- **Query Params** (optional):
  - `page`: page number (default: `1`)
  - `limit`: page size (default: `10`)
  - `category`: filter by category ID

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Videos retrieved successfully",
  "data": {
    "videos": [
      {
        "_id": "64f2...",
        "title": "Video title",
        "video": "https://.../video.mp4",
        "thumbnail": "https://.../thumb.jpg",
        "language": "en",
        "order": 1,
        "category": { "_id": "64f2...", "title": "Category name", "image": "https://.../image.jpg" }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalVideos": 48,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### GET `/api/videos/:id`

- **Description**: Get a single video by ID.
- **Auth**: Public
- **URL Params**: `id` — MongoDB ObjectId

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Video retrieved successfully",
  "data": {
    "_id": "64f2...",
    "title": "Video title",
    "video": "https://.../video.mp4",
    "thumbnail": "https://.../thumb.jpg",
    "language": "en",
    "order": 1,
    "category": { "_id": "64f2...", "title": "Category name" }
  }
}
```

### GET `/api/videos/category/:categoryId`

- **Description**: Get videos filtered by category.
- **Auth**: Public
- **URL Params**: `categoryId` — MongoDB ObjectId
- **Query Params**: `page`, `limit`

### POST `/api/videos`

- **Description**: Create a new video. Accepts `multipart/form-data` for file uploads or a URL in the `video` field.
- **Auth**: Admin
- **Content-Type**: `multipart/form-data`
- **Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | ✅ | Video title |
| `category` | string | ✅ | Category ObjectId |
| `video` | file \| string | ✅ | Video file upload **or** CDN/external URL |
| `thumbnail` | file \| string | — | Thumbnail file upload or URL |
| `language` | string | — | e.g. `en`, `ml`, `ur`, `hin` |

- **Success Response (201)**:

```json
{
  "success": true,
  "message": "Video created successfully",
  "data": {
    "_id": "64f2...",
    "title": "Video title",
    "video": "https://.../video.mp4",
    "thumbnail": "https://.../thumb.jpg",
    "language": "en",
    "order": 5,
    "category": { "_id": "64f2...", "title": "Category name" }
  }
}
```

### PUT `/api/videos/reorder`

- **Description**: Bulk reorder videos globally via drag-and-drop. Assigns `order` 1, 2, 3… in the order IDs are provided.
- **Auth**: Admin
- **Request Body**:

```json
{
  "videoIds": ["64f2...", "64f3...", "64f4..."]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `videoIds` | string[] | ✅ | Array of video ObjectIds in the desired display order |

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Videos reordered successfully"
}
```

### PUT `/api/videos/:id`

- **Description**: Update a video by ID. Accepts `multipart/form-data` for file replacements or `application/json` for field-only updates. Old CDN files are deleted automatically on replacement.
- **Auth**: Admin
- **Content-Type**: `multipart/form-data` or `application/json`
- **URL Params**: `id` — MongoDB ObjectId
- **Request Body** (all fields optional):

| Field | Type | Notes |
|---|---|---|
| `title` | string | Video title |
| `category` | string | Category ObjectId |
| `video` | file \| string | Replaces existing video |
| `thumbnail` | file \| string | Replaces existing thumbnail |
| `language` | string | e.g. `en`, `ml`, `ur`, `hin` |

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Video updated successfully",
  "data": { "_id": "64f2...", "title": "Updated title" }
}
```

### DELETE `/api/videos/:id`

- **Description**: Delete a video and its files (video + thumbnail) from CDN.
- **Auth**: Admin
- **URL Params**: `id` — MongoDB ObjectId

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Video deleted successfully",
  "data": { "id": "64f2...", "title": "Video title" }
}
```

---

## Trending Videos

### GET `/api/videos/trending`

- **Description**: List trending videos, sorted by `order` ascending.
- **Auth**: Public

- **Success Response (200)**:

```json
{
  "success": true,
  "data": {
    "trending": [
      {
        "_id": "64f2...",
        "order": 1,
        "video": {
          "_id": "64f3...",
          "title": "Video title",
          "thumbnail": "https://.../thumb.jpg",
          "video": "https://.../video.mp4",
          "category": { "_id": "64f4...", "title": "Category name", "image": "https://.../image.jpg" }
        }
      }
    ]
  }
}
```

### GET `/api/videos/trending/check/:videoId`

- **Description**: Check if a specific video is in the trending list.
- **Auth**: Public
- **URL Params**: `videoId` — MongoDB ObjectId

- **Success Response (200)**:

```json
{
  "success": true,
  "data": { "inTrending": true, "trendingEntryId": "64f2..." }
}
```

### POST `/api/videos/trending`

- **Description**: Add a video to the trending list. The entry is assigned the next available `order` value automatically.
- **Auth**: Admin
- **Request Body**:

```json
{
  "video": "64f2..."
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `video` | string | ✅ | Video ObjectId to add to trending |

- **Success Response (201)**:

```json
{
  "success": true,
  "message": "Video added to trending successfully",
  "data": { "_id": "64f2...", "order": 5, "video": { "_id": "64f3...", "title": "Video title" } }
}
```

### PUT `/api/videos/trending/reorder`

- **Description**: Bulk reorder the trending list via drag-and-drop. Assigns `order` 1, 2, 3… in the order IDs are provided.
- **Auth**: Admin
- **Request Body**:

```json
{
  "trendingIds": ["64f2...", "64f3...", "64f4..."]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `trendingIds` | string[] | ✅ | Array of trending entry ObjectIds in the desired display order |

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Trending order updated successfully"
}
```

### DELETE `/api/videos/trending/:id`

- **Description**: Remove a video from the trending list.
- **Auth**: Admin
- **URL Params**: `id` — trending entry ObjectId

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Video removed from trending successfully"
}
```

---

## Bright Boxes & Stories

### GET `/api/bright-boxes`

- **Description**: List bright boxes (categories) with pagination. Pass `all=true` to retrieve all records without pagination (useful for admin dropdowns).
- **Auth**: Public
- **Query Params** (optional):
  - `page`: page number (default: `1`)
  - `limit`: page size (default: `10`, max: `1000`)
  - `all`: `true` — return all records without pagination

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Bright boxes retrieved successfully",
  "data": {
    "brightBoxes": [
      {
        "_id": "64f2...",
        "title": "Box title",
        "mlTitle": "Malayalam title",
        "urTitle": "Urdu title",
        "hinTitle": "Hindi title",
        "image": "https://.../image.jpg",
        "order": 1
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalBrightBoxes": 25,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### GET `/api/bright-boxes/:id`

- **Description**: Get a single bright box by ID.
- **Auth**: Public
- **URL Params**: `id` — MongoDB ObjectId

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Bright box retrieved successfully",
  "data": {
    "_id": "64f2...",
    "title": "Box title",
    "mlTitle": "Malayalam title",
    "urTitle": "Urdu title",
    "hinTitle": "Hindi title",
    "image": "https://.../image.jpg",
    "order": 1
  }
}
```

### POST `/api/bright-boxes`

- **Description**: Create a new bright box category.
- **Auth**: Admin
- **Content-Type**: `multipart/form-data`
- **Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | ✅ | English title |
| `mlTitle` | string | — | Malayalam title |
| `urTitle` | string | — | Urdu title |
| `hinTitle` | string | — | Hindi title |
| `image` | file | — | Category cover image |

- **Success Response (201)**:

```json
{
  "success": true,
  "message": "Bright box created successfully",
  "data": {
    "_id": "64f2...",
    "title": "Box title",
    "image": "https://.../image.jpg",
    "order": 5
  }
}
```

### PUT `/api/bright-boxes/reorder`

- **Description**: Bulk reorder bright box categories via drag-and-drop. Assigns `order` 1, 2, 3… in the order IDs are provided.
- **Auth**: Admin
- **Request Body**:

```json
{
  "brightBoxIds": ["64f2...", "64f3...", "64f4..."]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `brightBoxIds` | string[] | ✅ | Array of bright box ObjectIds in the desired display order |

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Bright boxes reordered successfully"
}
```

### PUT `/api/bright-boxes/:id`

- **Description**: Update a bright box category. Old CDN image is deleted on replacement.
- **Auth**: Admin
- **Content-Type**: `multipart/form-data`
- **URL Params**: `id` — MongoDB ObjectId
- **Request Body** (all fields optional):

| Field | Type | Notes |
|---|---|---|
| `title` | string | English title |
| `mlTitle` | string | Malayalam title |
| `urTitle` | string | Urdu title |
| `hinTitle` | string | Hindi title |
| `image` | file | Replaces existing cover image |

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Bright box updated successfully",
  "data": { "_id": "64f2...", "title": "Updated title" }
}
```

### DELETE `/api/bright-boxes/:id`

- **Description**: Delete a bright box category and its image from CDN.
- **Auth**: Admin
- **URL Params**: `id` — MongoDB ObjectId

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Bright box deleted successfully"
}
```

---

### GET `/api/bright-box-stories`

- **Description**: List bright box stories with optional category filter and pagination. Pass `all=true` to retrieve all records.
- **Auth**: Public
- **Query Params** (optional):
  - `page`: page number (default: `1`)
  - `limit`: page size (default: `10`, max: `1000`)
  - `all`: `true` — return all records without pagination
  - `category`: filter by bright box (category) ObjectId

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Bright box stories retrieved successfully",
  "data": {
    "brightBoxStories": [
      {
        "_id": "64f2...",
        "title": "Story title",
        "mlTitle": "Malayalam title",
        "urTitle": "Urdu title",
        "hinTitle": "Hindi title",
        "image": "https://.../image.jpg",
        "enFile": "https://.../en.pdf",
        "mlFile": "https://.../ml.pdf",
        "urFile": "https://.../ur.pdf",
        "hinFile": "https://.../hin.pdf",
        "adBanner": "https://.../banner.jpg",
        "highlight": "Disable",
        "order": 1,
        "category": {
          "_id": "64f2...",
          "title": "Box title",
          "image": "https://.../image.jpg"
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 4,
      "totalBrightBoxStories": 38,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### GET `/api/bright-box-stories/:id`

- **Description**: Get a single bright box story by ID.
- **Auth**: Public
- **URL Params**: `id` — MongoDB ObjectId

### GET `/api/bright-box-stories/:id/download-pdf`

- **Description**: Get a signed PDF download URL for a bright box story.
- **Auth**: Public
- **URL Params**: `id` — MongoDB ObjectId
- **Query Params**:
  - `lang`: `en` | `ml` | `ur` | `hin` (default: `en`)

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "PDF download ready",
  "data": {
    "downloadUrl": "https://.../signed-url",
    "filename": "story_title.pdf"
  }
}
```

### GET `/api/bright-box-stories/category/:categoryId`

- **Description**: Get bright box stories filtered by category (bright box) ID with pagination.
- **Auth**: Public
- **URL Params**: `categoryId` — MongoDB ObjectId
- **Query Params**: `page`, `limit`

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Bright box stories retrieved successfully",
  "data": {
    "category": {
      "_id": "64f2...",
      "title": "Box title",
      "image": "https://.../image.jpg"
    },
    "brightBoxStories": [ ],
    "pagination": { "currentPage": 1, "totalPages": 2, "totalBrightBoxStories": 15 }
  }
}
```

### POST `/api/bright-box-stories`

- **Description**: Create a new bright box story.
- **Auth**: Admin
- **Content-Type**: `multipart/form-data`
- **Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | ✅ | English title |
| `category` | string | ✅ | Bright box (category) ObjectId |
| `enFile` | file | ✅ | English PDF file |
| `mlTitle` | string | — | Malayalam title |
| `urTitle` | string | — | Urdu title |
| `hinTitle` | string | — | Hindi title |
| `image` | file | — | Cover image |
| `mlFile` | file | — | Malayalam PDF |
| `urFile` | file | — | Urdu PDF |
| `hinFile` | file | — | Hindi PDF |
| `adBanner` | file | — | English ad banner |
| `mlBanner` | file | — | Malayalam ad banner |
| `urBanner` | file | — | Urdu ad banner |
| `hinBanner` | file | — | Hindi ad banner |
| `highlight` | string | — | `Enable` \| `Disable` (default: `Disable`) |

- **Success Response (201)**:

```json
{
  "success": true,
  "message": "Bright box story created successfully",
  "data": {
    "_id": "64f2...",
    "title": "Story title",
    "enFile": "https://.../en.pdf",
    "order": 3,
    "category": { "_id": "64f2...", "title": "Box title" }
  }
}
```

### PUT `/api/bright-box-stories/reorder`

- **Description**: Bulk reorder bright box stories via drag-and-drop. Assigns `order` 1, 2, 3… in the order IDs are provided.
- **Auth**: Admin
- **Request Body**:

```json
{
  "storyIds": ["64f2...", "64f3...", "64f4..."]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `storyIds` | string[] | ✅ | Array of bright box story ObjectIds in the desired display order |

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Bright box stories reordered successfully"
}
```

### PUT `/api/bright-box-stories/:id`

- **Description**: Update a bright box story. Old CDN files are deleted on replacement.
- **Auth**: Admin
- **Content-Type**: `multipart/form-data`
- **URL Params**: `id` — MongoDB ObjectId
- **Request Body** (all fields optional):

| Field | Type | Notes |
|---|---|---|
| `title` | string | English title |
| `mlTitle` | string | Malayalam title |
| `urTitle` | string | Urdu title |
| `hinTitle` | string | Hindi title |
| `category` | string | Bright box ObjectId |
| `highlight` | string | `Enable` \| `Disable` |
| `image` | file | Replaces cover image |
| `enFile` | file | Replaces English PDF |
| `mlFile` | file | Replaces Malayalam PDF |
| `urFile` | file | Replaces Urdu PDF |
| `hinFile` | file | Replaces Hindi PDF |
| `adBanner` | file | Replaces English ad banner |
| `mlBanner` | file | Replaces Malayalam banner |
| `urBanner` | file | Replaces Urdu banner |
| `hinBanner` | file | Replaces Hindi banner |

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Bright box story updated successfully",
  "data": { "_id": "64f2...", "title": "Updated title" }
}
```

### DELETE `/api/bright-box-stories/:id`

- **Description**: Delete a bright box story and all its associated files from CDN.
- **Auth**: Admin
- **URL Params**: `id` — MongoDB ObjectId

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Bright box story deleted successfully"
}
```

---

## Support / Balance (Razorpay)

### POST `/api/support/create-order`

- **Description**: Create a Razorpay order for a support payment (used by the public **Support/Balance** page).
- **Auth**: Public
- **Request Body**:
  - `name` (string, required)
  - `email` (string, required)
  - `phone` (string, optional)
  - `amount` (number, required) – support amount in **₹**; the backend converts this to paise for Razorpay
  - `message` (string, optional)

```json
{
  "name": "Supporter name",
  "email": "supporter@example.com",
  "phone": "+919876543210",
  "amount": 100,
  "message": "Optional support message"
}
```

- **Success Response (201)**:

```json
{
  "success": true,
  "message": "Support order created successfully",
  "data": {
    "keyId": "rzp_test_xxx",
    "orderId": "order_ABC123",
    "amount": 10000,
    "currency": "INR",
    "supportPaymentId": "64f2..."
  }
}
```

> **Note**: In the response, `amount` is returned in **paise** (e.g. `10000` = ₹100).

### POST `/api/support/verify`

- **Description**: Verify Razorpay payment signature after checkout and mark the support payment as `paid` or `failed`.
- **Auth**: Public
- **Request Body**:

```json
{
  "razorpay_order_id": "order_ABC123",
  "razorpay_payment_id": "pay_ABC123",
  "razorpay_signature": "signatureFromRazorpay"
}
```

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Support payment verified successfully",
  "data": {
    "supportPaymentId": "64f2..."
  }
}
```

### GET `/api/support`

- **Description**: Admin **Support/Balance** listing – paginated, filterable list of all support payments plus status summary for dashboard cards.
- **Auth**: Admin
- **Query Params** (all optional):
  - `status`: `created` | `paid` | `failed`
  - `search`: text search over `name`, `email`, `phone`, `orderId`, `paymentId`
  - `page`: page number (default: `1`)
  - `limit`: page size, max `100` (default: `20`)
  - `sortBy`: one of `name`, `email`, `amount`, `status`, `createdAt` (default: `createdAt`)
  - `sortOrder`: `asc` | `desc` (default: `desc`)

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Support payments fetched successfully",
  "data": [
    {
      "_id": "64f2...",
      "name": "Supporter name",
      "email": "supporter@example.com",
      "phone": "+919876543210",
      "amount": 10000,
      "currency": "INR",
      "message": "Optional support message",
      "status": "paid",
      "orderId": "order_ABC123",
      "paymentId": "pay_ABC123",
      "metadata": {},
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:10.000Z"
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "sortBy": "createdAt",
    "sortOrder": "desc"
  },
  "summary": {
    "created": 5,
    "paid": 30,
    "failed": 7
  }
}
```

> **Note**: The `summary` object is useful for showing an overall **support balance breakdown** by status on the admin dashboard.

---

## Puzzles

### GET `/api/puzzles`

- **Description**: List puzzles.
- **Auth**: Public

### POST `/api/puzzles`

- **Description**: Create puzzle.
- **Auth**: Admin

```json
{
  "title": "Puzzle title",
  "description": "Puzzle description",
  "image": "https://.../image.jpg",
  "answer": "Answer or solution"
}
```

---

## Banners & Payment Banner

### GET `/api/banners`

- **Description**: List banners.
- **Auth**: Public

### POST `/api/banners`

- **Description**: Create banner.
- **Auth**: Admin

```json
{
  "title": "Banner title",
  "image": "https://.../image.jpg",
  "link": "https://.../target-url"
}
```

### GET `/api/payment-banner`

- **Description**: Get active payment banner for public.
- **Auth**: Public

### PUT `/api/payment-banner`

- **Description**: Update payment banner config.
- **Auth**: Admin

```json
{
  "title": "Support us",
  "description": "Support message",
  "image": "https://.../image.jpg",
  "enabled": true
}
```

---

## Quizzes & Questions

### GET `/api/quizzes/config`

- **Description**: Get quiz configuration (timers, limits).
- **Auth**: Public

### POST `/api/quizzes/config`

- **Description**: Create or update quiz config.
- **Auth**: Admin

```json
{
  "dailyLimit": 1,
  "timePerQuestion": 30,
  "languages": ["en", "ml"]
}
```

### GET `/api/quizzes`

- **Description**: List quizzes.
- **Auth**: Public

### GET `/api/quizzes/today`

- **Description**: Get today’s active quiz.
- **Auth**: Public

### GET `/api/quizzes/stats`

- **Description**: Leaderboard & statistics for quizzes.
- **Auth**: Public

### POST `/api/quizzes/:quizId/attempt`

- **Description**: Submit a quiz attempt by quiz ID.
- **Auth**: Public (optionally with user token)

```json
{
  "language": "en",
  "answers": [
    {
      "questionId": "64f2...",
      "attemptedAnswer": 0,
      "duration": 5.2
    }
  ],
  "name": "John",
  "email": "john@example.com",
  "class": "10A",
  "phone": "+919876543210"
}
```

### Quiz Questions and Questions

Admin-only CRUD for managing question banks:

- `/api/quiz-questions`
- `/api/questions`

Both expose `GET`, `POST`, `PUT`, `DELETE` with bodies like:

```json
{
  "question": "What is 2 + 2?",
  "options": ["1", "2", "3", "4"],
  "correctAnswer": 3,
  "language": "en"
}
```

---

## Quiz Attempts

### GET `/api/quiz-attempts/me/today`

- **Description**: Get today’s attempt for the current user.
- **Auth**: User

### GET `/api/quiz-attempts/me`

- **Description**: Get paginated quiz attempts for current user.
- **Auth**: User

### POST `/api/quiz-attempts/attempt`

- **Description**: Submit quiz attempt (variant of `/api/quizzes/:quizId/attempt`).
- **Auth**: Public (optionally with user token)

---

## Users

### POST `/api/users/login`

- **Description**: User login (test/login endpoint).
- **Auth**: Public

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

### GET `/api/users/me`

- **Description**: Get current user profile using JWT.
- **Auth**: User
- **Headers**:
  - `Authorization: Bearer <user_token>`

---

## Activity / Growth

### GET `/api/activity/stats`

- **Description**: Dashboard statistics for admins (growth, engagement).
- **Auth**: Admin

### GET `/api/activity/users`

- **Description**: Users with growth and activity stats.
- **Auth**: Admin

### POST `/api/activity/update-streak`

- **Description**: Update user streak (or mark daily engagement).
- **Auth**: User/Admin

```json
{
  "userId": "optional for admin, inferred from token otherwise"
}
```

### POST `/api/activity/complete-book`

- **Description**: Mark a book/story as completed for a user.
- **Auth**: User/Admin

```json
{
  "userId": "optional for admin",
  "bookId": "story_or_episode_id",
  "bookType": "story"
}
```

---

## Notes

- Some request/response shapes above are inferred from controller logic and may exclude internal fields (timestamps, internal IDs, etc.).
- For file uploads, the API may expect multipart/form-data with files in fields like `coverImage` or `pdfFile`; when integrating, follow the frontend implementation or examples from the existing code.

---

## Home Banner / Highlights

The Home Banner system surfaces the **latest 5 highlighted items** from all four content types (Stories, Single Stories, Trending Videos, Bright Box) in a single sorted feed. Items enter the feed automatically when highlighted — no manual ordering required.

### GET `/api/highlights`

- **Description**: Get the latest 5 highlighted items across all content types, sorted by most recently updated. **This is the primary endpoint for the app home screen banner/carousel.** Each item includes the content file URLs needed for direct navigation and playback.
- **Auth**: Public

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Highlighted items retrieved successfully",
  "data": {
    "highlights": [
      {
        "_id": "64f2...",
        "type": "story",
        "contentType": "story",
        "contentId": "64f2...",
        "title": "Episode title",
        "mlTitle": "Malayalam title",
        "urTitle": "Urdu title",
        "hinTitle": "Hindi title",
        "image": "https://.../cover.jpg",
        "adBanner": "https://.../banner.jpg",
        "mlBanner": "https://.../ml-banner.jpg",
        "urBanner": "https://.../ur-banner.jpg",
        "hinBanner": "https://.../hin-banner.jpg",
        "storyFile": "https://.../en.pdf",
        "mlStoryFile": "https://.../ml.pdf",
        "urStoryFile": "https://.../ur.pdf",
        "hinStoryFile": "https://.../hin.pdf",
        "storyId": "64f3...",
        "storyTitle": "Parent story name",
        "seasonId": "64f4...",
        "seasonNumber": 1,
        "banner": null,
        "date": "2026-04-06T06:57:44.021Z",
        "updatedAt": "2026-04-06T06:57:44.021Z"
      },
      {
        "_id": "64f5...",
        "type": "single_story",
        "contentType": "single_story",
        "contentId": "64f5...",
        "title": "Story title",
        "mlTitle": "Malayalam title",
        "image": "https://.../cover.jpg",
        "mlBanner": "https://.../ml-banner.jpg",
        "enBanner": "https://.../en-banner.jpg",
        "enStoryFile": "https://.../en.pdf",
        "mlStoryFile": "https://.../ml.pdf",
        "banner": null,
        "date": "2026-04-05T10:00:00.000Z",
        "updatedAt": "2026-04-05T10:00:00.000Z"
      },
      {
        "_id": "64f6...",
        "type": "video",
        "contentType": "video",
        "contentId": "64f6...",
        "videoId": "64f7...",
        "title": "Video title",
        "image": "https://.../thumb.jpg",
        "videoUrl": "https://.../video.mp4",
        "trendingOrder": 1,
        "banner": null,
        "date": "2026-04-04T08:00:00.000Z",
        "updatedAt": "2026-04-04T08:00:00.000Z"
      },
      {
        "_id": "64f8...",
        "type": "brightbox",
        "contentType": "brightbox",
        "contentId": "64f8...",
        "title": "BrightBox story title",
        "mlTitle": "Malayalam title",
        "urTitle": "Urdu title",
        "hinTitle": "Hindi title",
        "image": "https://.../cover.jpg",
        "adBanner": "https://.../banner.jpg",
        "mlBanner": "https://.../ml-banner.jpg",
        "enFile": "https://.../en.pdf",
        "mlFile": "https://.../ml.pdf",
        "urFile": "https://.../ur.pdf",
        "hinFile": "https://.../hin.pdf",
        "category": {
          "_id": "64f9...",
          "title": "Category name",
          "image": "https://.../cat.jpg"
        },
        "banner": null,
        "date": "2026-04-03T09:00:00.000Z",
        "updatedAt": "2026-04-03T09:00:00.000Z"
      }
    ],
    "total": 5
  }
}
```

**App navigation logic** — use `contentType` to determine which screen to open:

| `contentType` | Navigate using | Content field |
|---|---|---|
| `story` | `storyId` + `seasonId` + `contentId` (episodeId) | `storyFile` / `mlStoryFile` / `urStoryFile` / `hinStoryFile` |
| `single_story` | `contentId` | `enStoryFile` / `mlStoryFile` |
| `video` | `videoId` | `videoUrl` |
| `brightbox` | `contentId` | `enFile` / `mlFile` / `urFile` / `hinFile` |

When a `banner` object is present, display the banner image on the home screen. Tapping it navigates to the content using the fields above.

---

### GET `/api/admin/highlights`

- **Description**: Admin view of highlighted items for a specific content type. Returns all highlighted items of that type with their banner and display metadata. Used by the admin **Home Banner** page.
- **Auth**: Admin
- **Query Params**:

| Param | Required | Values | Notes |
|---|---|---|---|
| `type` | ✅ | `story` \| `single_story` \| `video` \| `brightbox` | Content type to retrieve |

- **Success Response (200)**:

```json
{
  "success": true,
  "data": {
    "type": "single_story",
    "items": [
      {
        "_id": "64f5...",
        "type": "single_story",
        "title": "Story title",
        "mlTitle": "Malayalam title",
        "image": "https://.../cover.jpg",
        "highlightBannerId": "64fa...",
        "banner": {
          "_id": "64fb...",
          "title": "My Banner",
          "image": "https://.../banner.jpg",
          "pdf": null
        },
        "order": 0,
        "storyId": null,
        "seasonId": null,
        "updatedAt": "2026-04-05T10:00:00.000Z"
      }
    ],
    "total": 8
  }
}
```

---

### PUT `/api/admin/highlights/:contentType/:contentId`

- **Description**: Assign a banner and/or display order to a highlighted content item. Creates the association if it doesn't exist (upsert). Used by the admin **Home Banner** page.
- **Auth**: Admin
- **URL Params**:

| Param | Notes |
|---|---|
| `contentType` | `story` \| `single_story` \| `video` \| `brightbox` |
| `contentId` | MongoDB ObjectId — episode `_id` / singleStory `_id` / TrendingVideo `_id` / brightBoxStory `_id` |

- **Request Body** (`application/json`, all fields optional):

| Field | Type | Notes |
|---|---|---|
| `bannerId` | string \| null | Banner ObjectId to attach. Pass `null` or `""` to clear. |
| `order` | number | Display order (lower = shown first). Defaults to `0`. |
| `storyId` | string | Parent story ObjectId — **required for `story` type** for app navigation |
| `seasonId` | string | Parent season ObjectId — **required for `story` type** for app navigation |

```json
{
  "bannerId": "64fb...",
  "order": 1,
  "storyId": "64fc...",
  "seasonId": "64fd..."
}
```

- **Success Response (200)**:

```json
{
  "success": true,
  "data": {
    "_id": "64fa...",
    "contentType": "story",
    "contentId": "64f2...",
    "storyId": "64fc...",
    "seasonId": "64fd...",
    "banner": {
      "_id": "64fb...",
      "title": "My Banner",
      "image": "https://.../banner.jpg",
      "pdf": null
    },
    "order": 1,
    "createdAt": "2026-04-06T10:00:00.000Z",
    "updatedAt": "2026-04-06T10:00:00.000Z"
  }
}
```

---

### DELETE `/api/admin/highlights/:contentType/:contentId/banner`

- **Description**: Remove the banner from a highlighted content item. Preserves the `order` value and other metadata.
- **Auth**: Admin
- **URL Params**:

| Param | Notes |
|---|---|
| `contentType` | `story` \| `single_story` \| `video` \| `brightbox` |
| `contentId` | MongoDB ObjectId |

- **Success Response (200)**:

```json
{
  "success": true,
  "data": {
    "_id": "64fa...",
    "contentType": "single_story",
    "contentId": "64f5...",
    "banner": null,
    "order": 1,
    "updatedAt": "2026-04-06T11:00:00.000Z"
  }
}
```

- **Error Response (404)** — if no HighlightBanner record exists for this item:

```json
{
  "success": false,
  "message": "HighlightBanner record not found"
}
```

---

## Notices

App-wide announcements displayed as persistent in-app banners. Supports two types: `app` (shown in mobile app) and `admin` (shown in admin sidebar). Notices optionally include an image — uploaded as a file or provided as a URL.

### Data Model

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `type` | string | ✅ | — | `admin` \| `app` |
| `title` | string | ✅ | — | Notice title (trimmed) |
| `message` | string | ✅ | — | Notice body text (trimmed, no character limit) |
| `image` | string | — | `null` | CDN URL (from file upload) or external URL (from link) |
| `senderName` | string | — | `null` | Who is sending this notice (e.g. "Zaitoon Team") |
| `active` | boolean | — | `true` | Whether the notice is visible |
| `createdAt` | string | — | auto | ISO 8601 timestamp |
| `updatedAt` | string | — | auto | ISO 8601 timestamp |

---

### GET `/api/notices/app`

- **Description**: Get all active app notices for the mobile app.
- **Auth**: Public

- **Success Response (200)**:

```json
{
  "success": true,
  "data": [
    {
      "_id": "64f2...",
      "title": "To Our Creative Stars",
      "message": "We are receiving many wonderful creations...",
      "image": "https://.../notice-image.jpg",
      "senderName": "Zaitoon Team",
      "createdAt": "2026-04-21T00:00:00.000Z"
    }
  ]
}
```

---

### GET `/api/admin/notices`

- **Description**: Get all notices (both `admin` and `app` types) for the admin panel.
- **Auth**: Admin

- **Success Response (200)**:

```json
{
  "success": true,
  "data": [
    {
      "_id": "64f2...",
      "type": "app",
      "title": "To Our Creative Stars",
      "message": "We are receiving many wonderful creations...",
      "image": "https://.../notice-image.jpg",
      "senderName": "Zaitoon Team",
      "active": true,
      "createdAt": "2026-04-21T00:00:00.000Z",
      "updatedAt": "2026-04-21T00:00:00.000Z"
    }
  ]
}
```

---

### POST `/api/admin/notices`

- **Description**: Create a new notice. Accepts `multipart/form-data` for optional image upload or an image URL via the `imageLink` field. Both image options are optional.
- **Auth**: Admin
- **Content-Type**: `multipart/form-data`
- **Request Body**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | string | ✅ | `admin` \| `app` |
| `title` | string | ✅ | Notice title |
| `message` | string | ✅ | Notice body text (no character limit) |
| `senderName` | string | — | Who is sending this notice (e.g. "Zaitoon Team") |
| `image` | file | — | Image file upload (takes priority over `imageLink`) |
| `imageLink` | string | — | External image URL (used if no file uploaded) |

- **Success Response (201)**:

```json
{
  "success": true,
  "data": {
    "_id": "64f2...",
    "type": "app",
    "title": "New Announcement",
    "message": "Full notice message text...",
    "image": "https://.../uploaded-image.jpg",
    "senderName": "Zaitoon Team",
    "active": true,
    "createdAt": "2026-04-22T00:00:00.000Z",
    "updatedAt": "2026-04-22T00:00:00.000Z"
  }
}
```

- **Error Response (400)**:

```json
{
  "success": false,
  "message": "type, title, and message are required"
}
```

---

### PUT `/api/admin/notices/:id`

- **Description**: Update a notice. Accepts `multipart/form-data` for image replacement. Old CDN images are automatically deleted when replaced or removed. Send `removeImage: "true"` to clear the image without replacing it.
- **Auth**: Admin
- **Content-Type**: `multipart/form-data`
- **URL Params**: `id` — MongoDB ObjectId
- **Request Body** (all fields optional — only provided fields are updated):

| Field | Type | Notes |
|---|---|---|
| `title` | string | Notice title |
| `message` | string | Notice body text (no character limit) |
| `senderName` | string | Who is sending (pass empty string to clear) |
| `type` | string | `admin` \| `app` |
| `active` | boolean \| string | `true` / `"true"` to activate, `false` / `"false"` to deactivate |
| `image` | file | Replaces existing image (file upload takes priority) |
| `imageLink` | string | Replaces existing image with external URL |
| `removeImage` | string | `"true"` — removes current image without replacing |

> **Image priority**: `image` (file) > `imageLink` (URL) > `removeImage` (clear)

- **Success Response (200)**:

```json
{
  "success": true,
  "data": {
    "_id": "64f2...",
    "type": "app",
    "title": "Updated Announcement",
    "message": "Updated message text...",
    "image": "https://.../new-image.jpg",
    "senderName": "Zaitoon Team",
    "active": true,
    "createdAt": "2026-04-21T00:00:00.000Z",
    "updatedAt": "2026-04-22T00:00:00.000Z"
  }
}
```

- **Error Response (404)**:

```json
{
  "success": false,
  "message": "Notice not found"
}
```

---

### DELETE `/api/admin/notices/:id`

- **Description**: Delete a notice and its associated CDN image (if any).
- **Auth**: Admin
- **URL Params**: `id` — MongoDB ObjectId

- **Success Response (200)**:

```json
{
  "success": true,
  "message": "Notice deleted"
}
```

- **Error Response (404)**:

```json
{
  "success": false,
  "message": "Notice not found"
}
```


