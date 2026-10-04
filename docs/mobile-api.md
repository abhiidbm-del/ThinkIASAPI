# ThinkCivil mobile API

Base URL: the deployed backend origin followed by `/api`. Use HTTPS in production. Existing web APIs are shared with Android/iOS; there is no separate mobile login or duplicated database.

Send `Authorization: Bearer <token>` for authenticated requests. JSON requests use `Content-Type: application/json`; for uploads let the client set the multipart boundary. IDs are MongoDB IDs unless a question UID is explicitly requested. Dates are ISO strings. Schedule `time` is local academy time (Asia/Kolkata).

## Authentication and account

| Method | Path | Body / response |
| --- | --- | --- |
| POST | `/auth/send-otp` | `{ "email": "student@example.com" }` |
| POST | `/auth/verify-otp` | `{ "email": "student@example.com", "otp": "123456" }` |
| POST | `/auth/register` | `fullName`, `email`, `phone`, `password`, `confirmPassword`, `otp` |
| POST | `/auth/login` | `email`, `password`; returns `token`, `user`, `menuItems` |
| GET | `/auth/me` | Current `user` and authorized `menuItems`. Refresh after purchase. |
| POST | `/auth/forgot-password` | `email` |
| POST | `/auth/verify-reset-otp` | `email`, `otp` |
| POST | `/auth/reset-password` | `email`, `otp`, `newPassword`, `confirmPassword` |

Use the returned menu structure. Types are `fresh`, `pre`, `mains`, `combo`; combo includes both exam sections. Purchase preserves existing access. Displayed client prices must never substitute for server-calculated order amounts.

## Public content

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/plans` | Active plans, ordered by display order. Returns an array. |
| GET | `/plans/:planName` | Plan details; planName is `pre`, `mains`, `combo`. |
| GET | `/programs?activeOnly=true` | Programs; optional `category`, `year`. |
| GET | `/programs/:id` | Program details. |
| GET | `/programs/:programId/batches` | Active batches belonging to one program. |
| GET | `/mentorship?programId=...&batchId=...` | Active mentorship; optional program, batch, medium and search filters. |
| GET | `/testimonials/public` | Admin-managed active success stories. |
| GET | `/support-features/public` | Website support features. |
| GET | `/module/public` | Active study modules. |
| GET | `/module/public/module-tree/:id` | Module's nested material tree. Preserve parent IDs when navigating. |
| GET | `/module/public/directory?moduleId=...&parentId=...` | Public directory contents. |
| GET | `/module/public/file/:id` | Material metadata and file link. |
| GET | `/jobs?page=1&limit=10` | Careers; filters `type`, `location`, `requireVideo`. |
| GET | `/jobs/:id` | Career details and whether demo video is required. |
| POST | `/jobs/:jobId/apply` | Multipart: `name`, `email`, `contactNo`, optional `demoVideoLink`, required `resume` (PDF, max 10 MB). |

## Exams, answer sheets and schedules

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/tests` | Prelims tests. |
| GET | `/tests/:id/availability` | Availability before starting. |
| GET | `/tests/:id` | Exam questions. Keep English/Hindi variants together. |
| POST | `/tests/:id/submit` | Existing test submission contract; see `testController.js` for answer shape. |
| GET | `/prelims-ts/student/all` | Prelims series schedules (`pre` or `combo` account). |
| GET | `/mains-ts/student/all` | Mains series schedules (`mains` or `combo` account). |
| GET | `/{prelims-ts|mains-ts}/student/available` | Currently active series. |
| GET | `/{prelims-ts|mains-ts}/student/upcoming` | Upcoming series. |
| GET | `/live-tests/student/all` | Mains live tests with submission status. |
| GET | `/live-tests/student/my-participations` | Student's submitted Mains tests. |
| POST | `/live-tests/:id/submit` | Multipart `answerPDF` (PDF, max 10 MB), `language` (`en`/`hi`). |
| GET | `/answer-writing/available` | Available answer-writing exercises. |
| POST | `/answer-writing/:id/submit` | Multipart `answerPDF`, `language`. |
| GET | `/answer-writing/my-submissions` | Student's answer-writing submissions. |
| GET | `/answer-writing/my-evaluations` | Evaluations and feedback. |

Series are schedules; actual question papers/exams are managed through `/tests` and `/live-tests`. Creating a schedule does not fabricate question papers.

## Payment

- `GET /config/razorpay-config`: public Razorpay key/currency.
- `POST /payments/create-order`: `planId`, optional `couponCode`; use returned order in the native payment SDK.
- `POST /payments/verify-payment`: `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`.
- `POST /payments/activate-free-plan`: `planId`, `couponCode`, for a server-validated 100% discount.
- `GET /payments/history`: current user's payment history.
- After success call `/auth/me` to refresh access and menus.

## Notifications and language

- `POST /notifications/device-token`: `{ "token": "FCM_TOKEN", "platform": "android", "language": "hi" }`; platform can be `web`, `android`, `ios`. Re-register after language or account changes.
- `GET /notifications`: returns `data[]` with `isRead`, `title`, `titleHindi`, `body`, `bodyHindi`, `link`, `type`, `createdAt`.
- `PATCH /notifications/:id/read`: marks an accessible notification read for the authenticated account.
- FCM data contains `notificationId`, `type`, `link`. Map the internal route to the corresponding native screen.
- Prelims pushes target pre/combo; Mains pushes target mains/combo; combo feeds include both.
- Bulk delivery is split into groups of at most 500 recipients, following [Firebase Admin SDK documentation](https://firebase.google.com/docs/cloud-messaging/send/admin-sdk).

The API retains both languages; it does not machine-translate custom admin content. Fields use the existing naming conventions: plan/program/mentorship/testimonial `...Hindi`, live tests and series `...Hi`, questions `{english,hindi}`, module names `{english,hindi}`. Use Hindi when nonempty, otherwise English. IDs, status codes, prices, dates and enums remain language-independent.

## Proctoring

1. Obtain camera/screen/audio consent with the native OS capture APIs.
2. `POST /proctoring/sessions`: `testId`, `testType` (`Test` or `LiveTest`), `consent`.
3. Every 30 seconds `PATCH /proctoring/sessions/:id/heartbeat`; optional `violation` string. Optional JPEG/PNG/WebP `snapshot` upload to `/sessions/:id/snapshot` (max 2 MB).
4. `GET /proctoring/ice-config` provides ICE servers. Poll `/sessions/:id/live/offer`; post `{requestId,answer}` to `/sessions/:id/live/answer` using WebRTC.
5. On successful final answer submission stop local recording and every media track immediately, then `POST /proctoring/sessions/:id/end` (JSON `{}`). Admin stops displaying LIVE even while upload is pending.
6. Upload multipart `recording` to `/proctoring/sessions/:id/complete` (WebM/MP4, max 250 MB). Keep the captured blob/file until successful; retry a failed upload without restarting capture.

Browser capture implementation is in the student portal. Native clients must supply their own OS capture/recording and WebRTC implementation.

## Admin API additions

- `GET /admin/students/:id`: safe student profile fields (admin only).
- `GET /live-tests/:id/submissions`: student answer PDFs for a Mains live test (admin only).
- `/prelims-ts` and `/mains-ts`: POST create; GET `/admin` (page, limit, search, isActive); GET/PUT/DELETE `/:id`; PATCH `/:id/toggle-status`.
- `POST /questions/import`: multipart `file` (`.csv`/`.json`, max 5 MB) and `preview=true` for validation/preview; omit preview to save. Alternatively JSON `{questions:[...],preview:true}`. Maximum 1000 questions. CSV template is downloadable from Question Bank. Answer index is 0–3 or CSV A–D. Tags must exist (ID or name). Imports create new question IDs; they do not update existing questions.
- `GET /jobs/admin/all`, POST `/jobs`, PUT `/jobs/:id`, PATCH `/jobs/:id/toggle`: career management.
- `GET /admin/jobs/:jobId/applications`, GET `/admin/applications/:id/resume`: applicant review/download.

## Deployment and verification

Backend requires MongoDB, R2 storage credentials/public URL, JWT secret and payment configuration as already used by the app. Push additionally requires `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`; student web push requires its Firebase web configuration and VAPID key. TURN (`TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`) is used for WebRTC networks that cannot connect directly. Resume files are stored under `uploads/answer-sheets`; preserve that directory across deployments.

Automated checks use mocks/schema validation and do not send push notifications, charge payments or write production data. Real-device capture, deployed R2 playback, real Firebase delivery and payment verification require a configured staging environment.
