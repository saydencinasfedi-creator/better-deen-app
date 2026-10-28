// The Supabase URL and the publishable key are public by design (the app
// ships the same pair). Access is decided by the admin_* functions, which
// only answer to the accounts listed in public.admins.
window.ADMIN_CONFIG = {
  url: 'https://esncnavrvfbdftwgsrak.supabase.co',
  key: 'sb_publishable_6bsSJmlyF7tGvuC98LWpfw_tnMLryhy',
  // Public half of the Web Push keys (the private half is a server secret).
  vapidPublicKey: 'BIlwuPkPAaUuyHQeEaa89jEPLEm_RKVUgfHETnnQAQLSI7XwLdivnXWfrQs0bULCOT4bKVla_ZrmG8wXD9WnhmI',
};
