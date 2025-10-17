# ShiftSync TT - Restaurant Employee Scheduling System

Smart scheduling for Trinidad & Tobago restaurants. Built with local holidays, date formats, and mobile-first design.

## 🇹🇹 Built for Trinidad

- **Local Holidays**: Carnival, Independence Day, and all TT holidays pre-loaded
- **Date Format**: DD/MM/YYYY (Trinidad standard)
- **Time Format**: 12-hour with am/pm
- **Currency**: TTD (Trinidad & Tobago Dollar)
- **Mobile-First**: Optimized for Caribbean mobile networks

## 🚀 Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Deployment**: Vercel (recommended)

## 📋 Features

### For Restaurant Managers
- Create and manage weekly schedules
- Add/edit employee information
- Assign shifts with positions (server, cook, bartender, host)
- View blocked dates (holidays)
- Export schedules (future feature)

### For Employees
- View personal schedule
- See upcoming shifts
- Check total weekly hours
- Mobile-responsive interface

## 🛠️ Setup Instructions

### 1. Prerequisites
- Node.js 18+ installed
- Supabase account
- Git

### 2. Clone and Install
```bash
git clone <repository-url>
cd shiftsync-tt
npm install
```

### 3. Database Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)

2. In your Supabase dashboard, go to the SQL Editor

3. Copy and paste the entire contents of `database/schema.sql` and execute it

4. This will create all tables, policies, functions, and sample data

### 4. Environment Variables

1. Copy `.env.local` to create your environment file
2. Update with your Supabase credentials:

```env
# Get these from your Supabase project settings
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Keep these as defaults
NEXT_PUBLIC_DEFAULT_TIMEZONE=America/Port_of_Spain
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the landing page.

## 🗃️ Database Schema

### Tables
- **restaurants**: Restaurant information
- **employees**: Staff members with roles and positions
- **shifts**: Individual work shifts
- **blocked_dates**: Holidays and unavailable dates

### Key Features
- Row Level Security (RLS) enabled
- Automatic holiday population for new restaurants
- Shift conflict detection
- Trinidad holidays pre-loaded

## 🎨 Design System

The app uses a comprehensive design system with:
- **Primary Color**: Ocean Blue (#0ea5e9)
- **Position Colors**: Color-coded for different restaurant roles
- **Typography**: Inter font family
- **Components**: Fully accessible with focus states
- **Mobile**: 44px touch targets, optimized for mobile

See `ShiftSync-TT-Complete-Style-Guide.md` for full design specifications.

## 📱 Trinidad-Specific Features

### Date & Time
- All dates displayed as DD/MM/YYYY
- Time in 12-hour format (9:00am, not 09:00)
- Carnival dates (Feb 24-25, 2025) pre-loaded

### Currency
- Hourly rates in TTD format: $25.00 TTD
- Future: WiPay integration planned

### Holidays
Pre-loaded holidays include:
- New Year's Day (Jan 1)
- Carnival Monday & Tuesday (Feb 24-25, 2025)
- Emancipation Day (Aug 1)
- Independence Day (Aug 31)
- Christmas Day & Boxing Day (Dec 25-26)

## 🔧 Development

### Project Structure
```
src/
├── app/                 # Next.js app router pages
├── components/          # Reusable components
│   └── ui/             # shadcn/ui components
├── contexts/           # React contexts (auth, etc.)
├── lib/                # Utilities and configurations
│   ├── supabase.ts     # Supabase client
│   ├── database.types.ts # TypeScript types
│   └── date-utils.ts   # Trinidad date/time utilities
└── globals.css         # Global styles with design system
```

### Key Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Adding Components
```bash
# Add new shadcn/ui components
npx shadcn@latest add [component-name]
```

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Environment Variables for Production
Ensure these are set in your production environment:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (your production URL)

## 🧪 Testing

### Manual Testing Checklist
- [ ] User can view landing page
- [ ] Components render with correct Trinidad formatting
- [ ] Dates show as DD/MM/YYYY
- [ ] Times show as 12-hour format
- [ ] Mobile responsive (test at 375px width)
- [ ] Colors match design system
- [ ] Focus states work for accessibility

### Database Testing
After running the schema:
- [ ] Tables created successfully
- [ ] RLS policies working
- [ ] Default holidays inserted
- [ ] Functions execute without errors

## 🎯 Roadmap

### Phase 1 ✅ (Current)
- [x] Project setup with Next.js + Tailwind + Supabase
- [x] Database schema with RLS
- [x] Component library with design system
- [x] Trinidad-specific date/time utilities
- [x] Authentication context

### Phase 2 (Next)
- [ ] Sign up / login forms
- [ ] Restaurant onboarding flow
- [ ] Manager dashboard
- [ ] Employee management

### Phase 3
- [ ] Shift creation and editing
- [ ] Weekly schedule view
- [ ] Conflict detection
- [ ] Employee self-service portal

### Phase 4
- [ ] Mobile optimizations
- [ ] Offline support
- [ ] Push notifications
- [ ] Export to PDF

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the design system guidelines
4. Test on mobile (375px width minimum)
5. Ensure accessibility compliance
6. Submit a pull request

## 📄 License

This project is proprietary software for Trinidad & Tobago restaurants.

## 🆘 Support

For support with setup or deployment:
1. Check the database schema was executed correctly
2. Verify environment variables are set
3. Check Supabase project is active
4. Test with sample data from the schema

---

**Made in Trinidad & Tobago 🇹🇹**
