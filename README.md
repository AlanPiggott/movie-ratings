# Movie Discovery Platform

A modern movie discovery platform built with Next.js 14, TypeScript, and PostgreSQL. Features Google sentiment scores, streaming availability, and personalized recommendations.

## 🚀 Features

- **Google Sentiment Scores**: See how audiences really feel about movies
- **Streaming Availability**: Find where to watch across all major platforms
- **Advanced Search**: Filter by genre, year, rating, and more
- **Dark Theme**: Beautiful dark UI optimized for movie browsing
- **Responsive Design**: Works seamlessly on desktop and mobile
- **No Login Required**: Browse and search without creating an account

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS with custom dark theme
- **Database**: PostgreSQL with Prisma ORM
- **APIs**: 
  - TMDB for movie/TV show data
  - DataForSEO for Google "% liked" sentiment scores
  - Google Custom Search API (alternative option)
- **Authentication**: NextAuth.js (optional)
- **Caching**: Redis (optional)

## 📁 Project Structure

```
movie-discovery-platform/
├── app/                    # Next.js 14 app directory
│   ├── api/               # API routes
│   ├── movies/            # Movie pages
│   ├── search/            # Search functionality
│   ├── genres/            # Genre browsing
│   └── profile/           # User profiles (optional)
├── components/            # Reusable components
│   ├── ui/               # UI components
│   ├── layout/           # Layout components
│   ├── movies/           # Movie-specific components
│   └── search/           # Search components
├── lib/                   # Utilities and helpers
│   ├── prisma/           # Prisma client
│   ├── tmdb/             # TMDB API wrapper
│   └── utils/            # Utility functions
├── services/             # Business logic
│   ├── api/              # API services
│   ├── auth/             # Authentication
│   └── cache/            # Caching layer
├── prisma/               # Database schema
└── types/                # TypeScript types
```

## 🔧 Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- TMDB API key
- Google Custom Search API credentials

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd movie-discovery-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your credentials (see API Keys section below)

4. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to see the app.

### Database Setup

1. **Create a PostgreSQL database**
   ```sql
   CREATE DATABASE movie_discovery;
   ```

2. **Run migrations**
   ```bash
   npx prisma migrate dev --name init
   ```

3. **Seed the database (optional)**
   ```bash
   npm run prisma:seed
   ```

## 🔑 API Keys

### Required API Keys

#### 1. PostgreSQL Database
- **Local Development**: Install PostgreSQL locally or use Docker
- **Cloud Options**: 
  - [Supabase](https://supabase.com/) - Free tier available
  - [Neon](https://neon.tech/) - Free tier available
  - [Railway](https://railway.app/) - Simple deployment

#### 2. TMDB API
- **Sign up**: [https://www.themoviedb.org/signup](https://www.themoviedb.org/signup)
- **Get API Key**: 
  1. Go to [Settings > API](https://www.themoviedb.org/settings/api)
  2. Request an API key (choose "Developer" for personal use)
  3. Copy both the API Key (v3) and Read Access Token (v4)
- **Free Tier**: Yes, with rate limits

#### 3. DataForSEO API (for Google sentiment scores)
- **Sign up**: [https://dataforseo.com/register](https://dataforseo.com/register)
- **Get Credentials**: 
  1. Login to your dashboard
  2. Find your login email and password in account settings
  3. These are used for API authentication
- **Pricing**: Pay-as-you-go, $0.0006 per search result

### Optional API Keys

#### 4. Google Custom Search API (Alternative to DataForSEO)
- **Enable API**: 
  1. Go to [Google Cloud Console](https://console.cloud.google.com/)
  2. Create a new project or select existing
  3. Enable "Custom Search API"
  4. Create credentials (API Key)
- **Create Search Engine**: 
  1. Go to [Programmable Search Engine](https://programmablesearchengine.google.com/)
  2. Create a new search engine
  3. Configure to search the entire web
  4. Copy the Search Engine ID
- **Free Tier**: 100 queries/day

#### 5. Redis (for caching)
- **Local**: Install Redis locally or use Docker
- **Cloud Options**: 
  - [Upstash](https://upstash.com/) - Free tier with 10K commands/day
  - [Redis Cloud](https://redis.com/try-free/) - 30MB free

#### 6. NextAuth Secret
- **Generate**: Run `openssl rand -base64 32` in terminal
- **Purpose**: Used to encrypt JWT tokens for authentication

## 📝 Environment Variables

See `.env.example` for all required and optional environment variables with detailed descriptions



## 🧪 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio
- `npm run prisma:seed` - Seed the database

### Code Style

- TypeScript strict mode enabled
- Functional components with hooks
- Tailwind CSS for styling
- Mobile-first responsive design

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project to Vercel
3. Set environment variables
4. Deploy

### Docker

```dockerfile
# Dockerfile included for containerized deployment
docker build -t movie-discovery .
docker run -p 3000:3000 movie-discovery
```

## 📄 License

MIT License - feel free to use this project for your own purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.