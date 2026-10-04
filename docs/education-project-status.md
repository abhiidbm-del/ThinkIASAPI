# EducationProject.pdf implementation checklist

Reviewed 9 September 2026. This records code implementation, not production acceptance. The PDF's repeated requirements are mapped separately below.

| PDF item | Implementation |
| --- | --- |
| 1 Dynamic plans | Public home and student dashboard use admin-managed plans; bilingual plan fields and default translations. |
| 2 Dynamic testimonials | Public review slider uses stored testimonials; admin can maintain English/Hindi names, descriptions and subtitles. |
| 3 Our Programs UI | Dynamic program cards show bilingual descriptions, features and duration with responsive layout. |
| 4 Drive materials and folders | Drive file links are normalized while folder links/resource keys are preserved; module folder lookup and nested rename paths corrected. Existing shared links must grant students access. |
| 5 Dynamic mentorship | Public mentorship data comes from the API with bilingual content and batch information. |
| 6 Test series issues | Prelims and Mains schedule APIs, date validation, persistent admin CRUD and student schedule display. Actual exam papers remain managed under Tests/Live Tests. |
| 7 Careers | Public jobs and application flow connected; PDF resume validation; admin jobs and applicant/resume review page. |
| 8 Admin login redirect | Authentication no longer depends on the previous root route; dashboard redirect regression test added. |
| 9 Program-related batches | Program relation maintained, scoped batch selection and bilingual batch content. |
| 10 Batch-wise mentorship | Program/batch references, relation validation, scoped public filtering and admin selectors. Names may repeat across different batches. |
| 11 Relevant Firebase notifications | News and test publishing generate notifications; audience includes matching and combo students; push uses registered language. |
| 12 Student detail profile | Admin student detail endpoint and routed profile page. |
| 13 Prelims test series | Persisted schedule CRUD and student schedule view. |
| 14 Mains test series | Replaced in-memory mock operations with persisted schedule CRUD and student schedule view. |
| 15 Question upload/import | CSV/JSON import, bilingual template, preview, row validation and existing-tag resolution. |
| 16 Admin video monitoring | Active session monitoring, WebRTC live view and completed recording playback. |
| 17 Questions-master | Existing question bank integrated with the import workflow. |
| 18 Question import | Same implementation as item 15; imports create new question IDs. |
| 19 Mobile APIs | Existing/new endpoints documented in `mobile-api.md`, including auth, content, exams, notifications and capture lifecycle. Native mobile capture must be implemented by the mobile client. |
| 20 Fresh dashboard programs | Fresh-user dashboard renders API-driven programs. |
| 21 Upgrade plan | Dynamic upgrade choices; verified payment/activation preserves access and merges Prelims + Mains into combo. |
| 22 Purchased-plan menus | Plan refresh and access checks support pre, mains and combo; corrected Prelims free-plan classification. |
| 23 Success stories | Dashboard uses the dynamic testimonial slider instead of fictional static stories. |
| 24 Mains question/answer PDFs | Existing download/upload flow retained; final submission guards and admin submission list with answer PDF links added. |
| 25 Exam recording | Final submission stops all capture tracks before recording upload, retains the last chunk, ends live status and permits upload retry. Global retry banner survives route navigation in the same tab. |
| 26 Firebase | Language-aware token registration, notification feed, audience filtering, batches of up to 500 tokens and invalid-token cleanup. |

## Hindi and English

Both portals include a shared language selector and translated navigation/affected screens. Admin content forms now persist the relevant Hindi fields as well as English. Existing custom database content without a Hindi value falls back to English; it has not been silently machine-translated or rewritten. Populate those Hindi fields in the admin forms to finish translating institution-specific content. Existing separate Hindi/English papers and brochures remain separate assets.

## Verification and remaining acceptance work

- Eleven automated tests cover recording completion/retry, admin authentication, bilingual CSV import, question validation, schedule dates, plan access, audience matching, mocked Firebase batching/language, and Drive URLs.
- Both Angular portals are checked with development builds. Updated backend routes have been loaded without database writes or outbound delivery.
- Production/staging end-to-end acceptance remains: student + admin on separate devices, browser screen/camera permission, final-submit stream stop, R2 upload/playback, Hindi/English papers and answers, actual payment upgrade, actual Firebase delivery and resume persistence.
- Long recordings currently use the existing in-memory capture and 250 MB upload limit. A page refresh/closed tab loses an unuploaded recording. Test realistic exam lengths; resumable chunk storage is not implemented.
- Firebase credentials/web VAPID, R2, MongoDB, payment settings and (where needed) TURN must be configured. No deployment, real payment, production data mutation or live push was performed during these checks.

The project is ready for configured-environment acceptance testing; this checklist does not claim that all live services or all existing stored content have been verified.
