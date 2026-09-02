-- Create a dedicated Worknest / Digitix Flow database.
-- Do not run this against digitix_hrms. HRMS stays in its own database.
-- Run as a superuser (postgres) in pgAdmin Query Tool, or:
--   psql -U postgres -d postgres -f scripts/create-worknest-db.sql

CREATE DATABASE digitix_flow OWNER hrms;
GRANT ALL PRIVILEGES ON DATABASE digitix_flow TO hrms;
GRANT CONNECT ON DATABASE digitix_flow TO hrms;
