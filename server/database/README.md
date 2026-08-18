# Database Setup

1. Ensure you have PostgreSQL installed and running.
2. Create a new database for Backbench: `createdb backbench`
3. Set the `DATABASE_URL` environment variable in `server/.env`:
   `DATABASE_URL=postgres://username:password@localhost:5432/backbench`
4. Run the migration file:
   `psql $DATABASE_URL -f database/migrations/001_create_challenges.sql`
