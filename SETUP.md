# Hướng dẫn cài đặt & Triển khai

## 1. Tạo Firebase Project

1. Truy cập https://console.firebase.google.com
2. Tạo project mới → đặt tên (VD: `to-chu-thi-ck`)
3. **Bật Firestore Database**:
   - Build → Firestore Database → Create database
   - Chọn **Start in test mode**
   - Chọn region: `asia-southeast1`
4. **Bật Storage**:
   - Build → Storage → Get started
   - Chọn **Start in test mode**
5. **Thêm Web App**:
   - Project Settings → Your apps → Add app → Web (`</>`)
   - Đặt tên app, nhấn Register
   - Copy thông tin config (API key, authDomain, v.v.)
6. **Nâng cấp lên Blaze plan** (bắt buộc để dùng Cloud Functions):
   - Project Settings → Usage and billing → Modify plan → Blaze

---

## 2. Cấu hình biến môi trường Frontend

```bash
# Tạo file .env (sao chép từ .env.example)
cp .env.example .env
```

Mở file `.env` và điền thông tin Firebase:
```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=ten-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ten-project
VITE_FIREBASE_STORAGE_BUCKET=ten-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc...
VITE_GEMINI_API_KEY=AIzaSy...  (xem bước 3)
```

---

## 3. Lấy Gemini API Key

1. Truy cập https://aistudio.google.com/app/apikey
2. Đăng nhập bằng tài khoản Google
3. Nhấn **Create API key** → **Create API key in new project**
4. Copy API key vào `.env` và `functions/.env`

---

## 4. Cài đặt & Chạy local

```bash
# Cài dependencies frontend
npm install

# Chạy development server
npm run dev
```

Mở trình duyệt:
- **Học sinh**: http://localhost:5173
- **Giáo viên**: http://localhost:5173/teacher

---

## 5. Deploy Firebase Indexes & Rules

```bash
# Cài Firebase CLI (nếu chưa có)
npm install -g firebase-tools

# Đăng nhập
firebase login

# Chọn project
firebase use ten-project-id

# Deploy Firestore rules và indexes
firebase deploy --only firestore
firebase deploy --only storage
```

---

## 6. Deploy Cloud Functions

```bash
# Cài dependencies functions
cd functions
npm install
cd ..

# Cấu hình Gemini API key cho Functions
firebase functions:secrets:set GEMINI_API_KEY
# (nhập API key khi được hỏi)

# Deploy Functions
firebase deploy --only functions
```

---

## 7. Deploy lên Vercel

```bash
# Cài Vercel CLI
npm install -g vercel

# Build và deploy
npm run build
vercel --prod

# Hoặc kết nối với GitHub repo tại vercel.com
```

**Cài environment variables trên Vercel:**
- Settings → Environment Variables
- Thêm tất cả biến từ file `.env`

---

## Cấu trúc thư mục

```
to-chu-thi-ck/
├── src/
│   ├── firebase/config.js     # Firebase initialization
│   ├── hooks/                 # useFirestore, useTimer, useStorage
│   ├── utils/                 # grading, export, questionParser, cn
│   ├── components/
│   │   ├── ui/                # Button, Input, Modal, Badge, Card, Spinner
│   │   ├── layout/            # TeacherLayout
│   │   └── questions/         # QuestionForm, QuestionRenderer, QuestionReview
│   └── pages/
│       ├── teacher/           # Dashboard, QuestionBank, Template, Exam, Monitor, Review, Export
│       └── student/           # JoinPage, ExamPage (+ waiting/submitted screens)
├── functions/
│   ├── index.js               # Cloud Functions (triggers + callable)
│   └── grading/
│       ├── mcGrading.js       # MC auto-grade
│       ├── wordGrading.js     # Gemini AI grading
│       └── scratchGrading.js  # Scratch VM + fallback
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
└── vercel.json
```

---

## Luồng hoạt động

```
Giáo viên:
  1. /teacher/questions  → Tạo ngân hàng câu hỏi (8 dạng)
  2. /teacher/templates  → Tạo đề thi (chọn câu, rubric, test case)
  3. /teacher/exams      → Tạo ca thi → nhận mã 6 ký tự
  4. /teacher/monitor/:id → Theo dõi + bấm "Bắt đầu thi"
  5. /teacher/review/:id  → Xem bài + trigger AI chấm
  6. /teacher/export      → Xuất Excel

Học sinh:
  1. /  → Nhập tên, lớp, tên máy, mã phòng → vào phòng thi
  2. Chờ giáo viên bắt đầu
  3. Làm bài (trắc nghiệm + upload file thực hành)
  4. Nộp bài (hoặc tự động nộp khi hết giờ)
```

---

## Lưu ý quan trọng

- Firebase **Blaze plan** là bắt buộc cho Cloud Functions và Storage > 5GB
- Gemini Flash 2.5 miễn phí có giới hạn 15 requests/phút — đủ dùng cho lớp học
- Scratch grading chạy bằng `scratch-vm` headless — nếu lỗi sẽ dùng phân tích cấu trúc
- 500+ học sinh: Firestore snapshot listeners tự động scale, không cần cấu hình thêm
