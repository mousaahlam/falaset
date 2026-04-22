-- Minimal seed data for local development.
insert into public.items (kind, title, subtitle, url, country, locale, tags, rank) values
  ('content', 'Welcome to Falaset', 'A global center for useful content and apps', 'https://example.com/welcome', null, 'en', array['intro'], 100),
  ('app',     'Example App',       'Try the demo experience',                      'https://example.com/app',     null, 'en', array['demo'],   90);
