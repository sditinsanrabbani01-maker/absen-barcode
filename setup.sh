#!/bin/bash

# Setup script for Absen Barcode deployment
echo "🚀 Setting up Absen Barcode for deployment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please update with your actual credentials."
    echo "⚠️  IMPORTANT: Update .env file with your Supabase credentials before running the app!"
else
    echo "✅ .env file already exists."
fi

echo ""
echo "🔧 Setup complete! Next steps:"
echo ""
echo "1. 📊 Setup Supabase Database:"
echo "   - Go to https://supabase.com/dashboard"
echo "   - Create new project or use existing: jfvmledccblgzvjzytaz"
echo "   - Run the SQL commands in 'supabase-schema.sql' in SQL Editor"
echo ""
echo "2. ⚙️  Configure Environment Variables:"
echo "   - Update .env file with your Supabase credentials"
echo "   - Update VITE_CORS_ORIGIN with your production domain"
echo ""
echo "3. 🚀 Deploy to Vercel:"
echo "   - Install Vercel CLI: npm i -g vercel"
echo "   - Login: vercel login"
echo "   - Deploy: vercel --prod"
echo "   - Set environment variables in Vercel dashboard"
echo ""
echo "4. 🌐 Access your app:"
echo "   - Your app will be available at: https://your-app-name.vercel.app"
echo ""
echo "📖 For detailed instructions, see DEPLOYMENT.md"
echo ""
echo "🎯 To start development server:"
echo "   npm run dev"