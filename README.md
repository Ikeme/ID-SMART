"# ID-SMART - FUTO Student ID Card Generator

## 🎓 Description
Automated student ID card generator for Federal University of Technology Owerri (FUTO). This application generates professional student ID cards with QR codes, photos, and all necessary student information.

## ✨ Features
- Generate front and back ID cards with professional templates
- QR code generation with student information
- Automatic image processing and resizing
- Cloud storage with Cloudinary (no local file system dependency)
- Serverless-ready architecture for Vercel deployment
- Support for multiple faculties and departments

## 🚀 Deployment

### Vercel Setup
1. Fork this repository
2. Sign up at [Cloudinary](https://cloudinary.com) (free tier available)
3. Get your Cloudinary credentials from the Dashboard
4. Click the button below to deploy to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Ikeme/ID-SMART)

5. Add environment variables in Vercel Dashboard → Settings → Environment Variables:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

### Environment Variables
Required environment variables for the application:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## 🛠️ Local Development

### Prerequisites
- Node.js >= 18.0.0
- Cloudinary account (free tier is sufficient)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Ikeme/ID-SMART.git
cd ID-SMART
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env and add your Cloudinary credentials
```

4. Start the development server:
```bash
npm start
```

5. Open your browser and navigate to:
```
http://localhost:3000
```

## 📋 Usage

1. Fill in the student information form:
   - Name
   - Registration Number
   - Faculty
   - Department
   - Gender
   - Expiry Date (e.g., 2024/2025)

2. Upload a passport photo (PNG, JPG, JPEG, or GIF format)

3. Click "Generate" to create the ID card

4. Download both the front and back cards from the provided links

## 🏗️ Architecture

### Technology Stack
- **Backend**: Node.js with Express
- **Image Processing**: Canvas (node-canvas)
- **QR Code Generation**: qrcode library
- **Cloud Storage**: Cloudinary
- **Deployment**: Vercel (serverless)

### How It Works
1. User uploads a photo and fills in student information
2. Photo is uploaded to Cloudinary and automatically resized (280x280)
3. QR code is generated with student information
4. ID cards (front and back) are generated in-memory using Canvas
5. Generated cards are uploaded to Cloudinary
6. User receives Cloudinary URLs for download

### Cloudinary Integration
- Photos are stored in `futo-id-cards/uploads/` folder
- Generated ID cards are stored in `futo-id-cards/generated/` folder
- All images are publicly accessible via secure URLs
- No local file system usage (Vercel serverless compatible)

## 🔐 Security

- File size limit: 16MB maximum
- Allowed file types: JPG, JPEG, PNG, GIF only
- Input validation for all form fields
- Sanitized filenames to prevent path traversal
- Environment variables for sensitive credentials

## 📝 License
MIT License - see LICENSE file for details

## 🤝 Contributing
Contributions, issues, and feature requests are welcome!

## 👨‍💻 Author
FUTO ID-SMART Project

## 🙏 Acknowledgments
- Federal University of Technology Owerri (FUTO)
- Cloudinary for image storage
- Vercel for serverless deployment
" 
